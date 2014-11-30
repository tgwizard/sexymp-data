# Sexy MP data and scripts

[![DOI](https://zenodo.org/badge/7471/tgwizard/sexymp-data.svg)](http://dx.doi.org/10.5281/zenodo.12984)


# Process data

## Node.js scripts

For preprocessing data.

Requirements:

 - Node.js. Download and install from [nodejs.org](http://nodejs.org/)

Install dependencies by starting a terminal and running

    npm install

There are data from sexymp.co.uk and health data stored in the `data/raw` folder. You can download up-to-date data from sexymp.co.uk by running

    ./lib/download_sexymp_html.js

Process all data by running

    ./run.sh
    # or
    ./run.sh > log.txt

The processed data is available in `data/processed`.

## R scripts

For analysis.

1. Open the .r file in the root directory. 
2. Modify the paths to suit your local setup.
3. Run the script.


# Licence

The health data is from the ONS and licenced under the [Open Government
Licence](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/2/).

The code is [free](LICENSE.md).
