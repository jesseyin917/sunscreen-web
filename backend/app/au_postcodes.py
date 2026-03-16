import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Optional


@dataclass(frozen=True)
class AuPlace:
    postcode: str
    suburb: str
    state: str
    lat: float
    lon: float

    @property
    def display_name(self) -> str:
        # Keep display consistent with Nominatim-style output.
        parts = [self.suburb]
        if self.state:
            parts.append(self.state)
        if self.postcode:
            parts.append(self.postcode)
        parts.append("Australia")
        return ", ".join(p for p in parts if p)


_DEFAULT_DB_PATH = os.getenv("POSTCODES_DB_PATH", "/tmp/postcodes_geo.sqlite")
_DEFAULT_SQL_PATH = os.getenv(
    "POSTCODES_SQL_PATH",
    str(Path(__file__).resolve().parent.parent / "data" / "postcodes_geo_mysql.sql"),
)


def _connect(db_path: str = _DEFAULT_DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_postcodes_db(conn: sqlite3.Connection, sql_dump_path: str = _DEFAULT_SQL_PATH) -> None:
    """Ensure SQLite DB exists + is populated.

    We intentionally do NOT run the raw dump as SQL because it is MySQL-flavoured
    (SET NAMES, collations, auto_increment, engine). Instead we parse the INSERT
    values and populate a SQLite table.

    This keeps deployment simple (works on Render even without a managed DB) and
    makes the behaviour deterministic and AU-only.
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS postcodes_geo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postcode TEXT,
            suburb TEXT,
            state TEXT,
            latitude REAL,
            longitude REAL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_postcodes_geo_postcode ON postcodes_geo(postcode)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_postcodes_geo_suburb ON postcodes_geo(suburb)")
    conn.commit()

    row = conn.execute("SELECT COUNT(*) AS c FROM postcodes_geo").fetchone()
    if row and int(row["c"]) > 0:
        return

    dump = Path(sql_dump_path)
    if not dump.exists():
        raise FileNotFoundError(f"AU postcode SQL dump not found: {dump}")

    batch: list[tuple[str, str, str, float, float]] = []
    inserted = 0
    with dump.open("r", encoding="utf-8", errors="ignore") as f:
        for place in _iter_places_from_mysql_dump(f):
            batch.append((place.postcode, place.suburb, place.state, place.lat, place.lon))
            if len(batch) >= 5000:
                conn.executemany(
                    "INSERT INTO postcodes_geo (postcode, suburb, state, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
                    batch,
                )
                conn.commit()
                inserted += len(batch)
                batch.clear()

        if batch:
            conn.executemany(
                "INSERT INTO postcodes_geo (postcode, suburb, state, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
                batch,
            )
            conn.commit()
            inserted += len(batch)

    # Basic sanity log (stdout) for platform logs.
    print(f"Loaded {inserted} AU postcode rows into SQLite: {dump}")


def lookup_place(conn: sqlite3.Connection, q: str) -> Optional[AuPlace]:
    q = (q or "").strip()
    if not q:
        return None

    # Optional state hint e.g. "Clayton VIC" or "Clayton, VIC".
    state_hint = None
    m = re.search(r"\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b", q.upper())
    if m:
        state_hint = m.group(1)

    # If the query is a pure postcode.
    if q.isdigit():
        rows = conn.execute(
            "SELECT postcode, suburb, state, latitude, longitude FROM postcodes_geo WHERE postcode = ? LIMIT 1",
            (q,),
        ).fetchall()
        if not rows:
            return None
        r = rows[0]
        return AuPlace(str(r["postcode"]), str(r["suburb"]), str(r["state"]), float(r["latitude"]), float(r["longitude"]))

    # Otherwise treat as suburb text.
    # Prefer exact match first, then prefix match.
    suburb = re.sub(r"\s*(,|\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b)\s*", " ", q, flags=re.I).strip()

    params: list[object] = [suburb]
    where = "suburb = ?"
    if state_hint:
        where += " AND state = ?"
        params.append(state_hint)

    row = conn.execute(
        f"SELECT postcode, suburb, state, latitude, longitude FROM postcodes_geo WHERE {where} LIMIT 1",
        tuple(params),
    ).fetchone()
    if row:
        return AuPlace(str(row["postcode"]), str(row["suburb"]), str(row["state"]), float(row["latitude"]), float(row["longitude"]))

    # Fallback: prefix match
    params2: list[object] = [suburb + "%"]
    where2 = "suburb LIKE ?"
    if state_hint:
        where2 += " AND state = ?"
        params2.append(state_hint)

    row2 = conn.execute(
        f"SELECT postcode, suburb, state, latitude, longitude FROM postcodes_geo WHERE {where2} ORDER BY suburb ASC LIMIT 1",
        tuple(params2),
    ).fetchone()
    if not row2:
        return None

    return AuPlace(
        str(row2["postcode"]),
        str(row2["suburb"]),
        str(row2["state"]),
        float(row2["latitude"]),
        float(row2["longitude"]),
    )


# ----------------------------
# Dump parsing (MySQL-ish)
# ----------------------------

def _iter_places_from_mysql_dump(lines: Iterable[str]) -> Iterator[AuPlace]:
    in_insert = False
    buf = ""

    for line in lines:
        if not in_insert:
            if line.lstrip().upper().startswith("INSERT INTO POSTCODES_GEO"):
                in_insert = True
                # We only need everything after VALUES
                parts = line.split("VALUES", 1)
                if len(parts) == 2:
                    buf += parts[1]
                continue
            else:
                continue

        # We are inside the big INSERT ... VALUES (...) ...(;
        buf += line
        if ";" in line:
            # Parse the full VALUES payload in buf.
            yield from _parse_values_payload(buf)
            return


def _parse_values_payload(payload: str) -> Iterator[AuPlace]:
    # Find the first '(' and parse tuples char-by-char.
    i = payload.find("(")
    if i == -1:
        return

    n = len(payload)
    while i < n:
        # Seek next tuple start.
        while i < n and payload[i] != "(":
            i += 1
        if i >= n:
            break
        i += 1  # skip '('

        fields: list[object] = []
        while i < n:
            i = _skip_ws(payload, i)
            if i >= n:
                break

            ch = payload[i]
            if ch == "'":
                s, i = _parse_sql_string(payload, i)
                fields.append(s)
            else:
                num, i = _parse_sql_number(payload, i)
                fields.append(num)

            i = _skip_ws(payload, i)
            if i < n and payload[i] == ",":
                i += 1
                continue
            if i < n and payload[i] == ")":
                i += 1
                break

        # Expect 5 columns: postcode, suburb, state, lat, lon
        if len(fields) >= 5:
            try:
                postcode = str(fields[0])
                suburb = str(fields[1])
                state = str(fields[2])
                lat = float(fields[3])
                lon = float(fields[4])
                yield AuPlace(postcode=postcode, suburb=suburb, state=state, lat=lat, lon=lon)
            except Exception:
                pass

        # Move forward to next tuple; tolerate trailing commas
        while i < n and payload[i] not in "(;"):
            if payload[i] == "(":
                break
            i += 1


def _skip_ws(s: str, i: int) -> int:
    n = len(s)
    while i < n and s[i] in " \t\r\n":
        i += 1
    return i


def _parse_sql_string(s: str, i: int) -> tuple[str, int]:
    # s[i] == '\''
    i += 1
    out = []
    n = len(s)
    while i < n:
        ch = s[i]
        if ch == "\\":
            # Backslash escape (e.g., O\'Connor)
            if i + 1 < n:
                out.append(s[i + 1])
                i += 2
                continue
        if ch == "'":
            # Either end, or doubled '' escape
            if i + 1 < n and s[i + 1] == "'":
                out.append("'")
                i += 2
                continue
            i += 1
            break
        out.append(ch)
        i += 1
    return "".join(out), i


def _parse_sql_number(s: str, i: int) -> tuple[float, int]:
    n = len(s)
    j = i
    while j < n and s[j] not in ",)\r\n\t ":
        j += 1
    token = s[i:j].strip()
    # Handle NULL
    if token.upper() == "NULL" or token == "":
        return 0.0, j
    try:
        return float(token), j
    except ValueError:
        return 0.0, j
