```sh
curl -O http://download.geonames.org/export/dump/countryInfo.txt
curl -O http://download.geonames.org/export/dump/cities500.zip
unzip cities500.zip
python geonames_cities_sqlite.py geonames.sqlite3 \
    countryInfo.txt cities500.txt 
```