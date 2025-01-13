import sqlite3
import sys
import csv


def do_sql(conn, sql):
    print(sql, file=sys.stderr)
    conn.execute(sql)
    conn.commit()


def do_file(conn, infile, table_name, expected_fields):
    sql = f"INSERT INTO {table_name} VALUES ({','.join(['?'] * expected_fields)})"
    print(sql, file=sys.stderr)
    cursor = conn.cursor()

    with open(infile, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        reader = (row for row in reader if not row[0].startswith("#"))
        for i, row in enumerate(reader):
            if len(row) != expected_fields:
                print(
                    f"{infile}:{i+1}: got {len(row)} fields (expected {expected_fields})",
                    file=sys.stderr,
                )
                continue
            cursor.execute(sql, row)
    conn.commit()


if len(sys.argv) != 4:
    print(
        f"usage: {sys.argv[0]} geonames.sqlite3 countryInfo.txt cities500.txt",
        file=sys.stderr,
    )
    sys.exit(1)

file, in_country, in_cities = sys.argv[1:4]

conn = sqlite3.connect(file)
conn.isolation_level = None

do_sql(conn, "DROP TABLE IF EXISTS geoname")
do_sql(
    conn,
    """CREATE TABLE geoname (
    geonameid INTEGER PRIMARY KEY,
    name TEXT,
    asciiname TEXT,
    alternatenames TEXT,
    latitude REAL,
    longitude REAL,
    fclass TEXT,
    fcode TEXT,
    country TEXT,
    cc2 TEXT,
    admin1 TEXT,
    admin2 TEXT,
    admin3 TEXT,
    admin4 TEXT,
    population INTEGER,
    elevation INTEGER,
    gtopo30 INTEGER,
    timezone TEXT,
    moddate TEXT)""",
)

do_sql(conn, "DROP TABLE IF EXISTS country")
do_sql(
    conn,
    """CREATE TABLE country (
    ISO TEXT PRIMARY KEY,
    ISO3 TEXT NOT NULL,
    IsoNumeric TEXT NOT NULL,
    fips TEXT NOT NULL,
    Country TEXT NOT NULL,
    Capital TEXT NOT NULL,
    Area INTEGER NOT NULL,
    Population INTEGER NOT NULL,
    Continent TEXT NOT NULL,
    tld TEXT NOT NULL,
    CurrencyCode TEXT NOT NULL,
    CurrencyName TEXT NOT NULL,
    Phone TEXT NOT NULL,
    PostalCodeFormat TEXT,
    PostalCodeRegex TEXT,
    Languages TEXT NOT NULL,
    geonameid INTEGER NOT NULL,
    neighbours TEXT NOT NULL,
    EquivalentFipsCode TEXT NOT NULL)""",
)

do_file(conn, in_country, "country", 19)
do_file(conn, in_cities, "geoname", 19)

do_sql(conn, "DROP TABLE IF EXISTS guess")
do_sql(
    conn,
    """CREATE TABLE guess (
    geonameid INTEGER PRIMARY KEY,
    name TEXT,
    asciiname TEXT,
    countryISO TEXT,
    country TEXT,
    continent TEXT,
    population INTEGER,
    elevation INTEGER,
    latitude REAL,
    longitude REAL,
    timezone TEXT)""",
)

do_sql(
    conn,
    """INSERT INTO guess
SELECT 
    g.geonameid, 
    g.name, 
    g.asciiname, 
    c.ISO,
    c.Country, 
    c.Continent, 
    g.population,
    g.elevation,
    g.latitude, 
    g.longitude, 
    g.timezone
FROM geoname g, country c
WHERE g.country = c.ISO
    AND g.population > 15000
    AND fcode != 'PPLX'""",
)


conn.commit()
conn.close()
