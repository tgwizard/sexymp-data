set -e

echo "Starting processing"
echo "Will not download new data from http://sexymp.co.uk"
echo "Run './lib/download_sexymp_html.js' to do that"

echo "==== `date`"

./lib/parse_sexymp_html.js
echo "==== `date`"
./lib/parse_life_expectancy.js
echo "==== `date`"
./lib/parse_deaths_and_rates.js
echo "==== `date`"

./lib/enrich_mp.js
echo "==== `date`"
./lib/enrich_life_expectancy.js
echo "==== `date`"
./lib/enrich_deaths_and_rates.js
echo "==== `date`"

./lib/match_mp_with_life_expectancy.js
echo "==== `date`"
./lib/match_mp_with_deaths_and_rates.js
echo "==== `date`"

echo "Done processing at `date`"
echo "See files (CSV and JSON) in ./data/processed/"
