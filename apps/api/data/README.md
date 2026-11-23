# Delivery city catalog

`delivery-cities.json.gz` contains selected fields from GeoNames `cities5000.zip` and `admin1CodesASCII.txt`, retrieved November 19, 2026. It is distributed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Data © [GeoNames](https://www.geonames.org/). [Source files](https://download.geonames.org/export/dump/).

The compressed JSON rows contain the GeoNames ID, city name, ISO country code, first-level region name, population, and selected ASCII aliases. Cities are ordered by population for initial suggestions. Cities outside this source's coverage require a catalog update.

City centre coordinates from the November 21, 2026 `cities5000.zip` export are appended to matching GeoNames IDs. Listings without a saved map pin can use these city centres for an approximate Places nearby section.

`nearby-places.json.gz` is a filtered copy of the November 21, 2026 GeoNames
`allCountries.zip` export under the same CC BY 4.0 license. Its rows contain
latitude, longitude, category, and name for named transit stops, schools,
healthcare sites, malls and markets, banks, parks, and places of worship.
The API uses the catalog locally and returns names and categories.
