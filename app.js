require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, query, validationResult } = require('express-validator');
const moment = require('moment');

const app = express();
const port = process.env.PORT || 8000;

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '15mb' }));
app.use(cors());

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// /ill-api endpoint with input validation and error handling
app.get(
  '/ill-api',
  [query('q').notEmpty().withMessage('Query parameter q is required')],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const response = await fetch(
        `https://data.illinois.gov/api/3/action/datastore_search?resource_id=e13b2a67-21eb-425d-9692-24a1beb9a14e&q=${req.query.q}`,
      );
      if (!response.ok) {
        throw new Error(`Illinois API responded with ${response.status}`);
      }
      const result = await response.json();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  },
);

app.get('/colo-api', async (req, res, next) => {
  try {
    const { searchType, name, licensenumber } = req.query;
    let apiUrl = 'https://data.colorado.gov/resource/7s5z-vewr.json';

    if (searchType === 'name') {
      let queryParams = '';

      if (name.includes(' ')) {
        // Split the name into first and last name if there's a space
        const [firstName, lastName] = name.trim().split(/\s+/);
        queryParams = `?firstname=${encodeURIComponent(
          firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
        )}&lastname=${encodeURIComponent(
          lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
        )}`;
      } else {
        // If there's no space, treat it as a last name
        const lastName =
          name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        queryParams = `?lastname=${encodeURIComponent(lastName)}`;
      }

      apiUrl += queryParams;
    } else if (searchType === 'license') {
      // Handle search by license number
      apiUrl += `?licensenumber=${encodeURIComponent(licensenumber)}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'X-App-Token': process.env.CO_APP_TOKEN, // Use the environment variable for the app token
      },
    });

    if (!response.ok) {
      throw new Error(`Colorado API responded with ${response.status}`);
    }

    let result = await response.json();

    // Convert date fields using moment
    result = result.map((item) => {
      if (item.licensefirstissuedate) {
        item.licensefirstissuedate = moment(item.licensefirstissuedate).format('MM/DD/YYYY');
      }
      if (item.licenselastreneweddate) {
        item.licenselastreneweddate = moment(item.licenselastreneweddate).format('MM/DD/YYYY');
      }
      if (item.licenseexpirationdate) {
        item.licenseexpirationdate = moment(item.licenseexpirationdate).format('MM/DD/YYYY');
      }
      if (item.disciplineeffectivedate) {
        item.disciplineeffectivedate = moment(item.disciplineeffectivedate).format('MM/DD/YYYY');
      }
      return item;
    });

    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});

app.post(
  '/cali-api',
  [
    body('licenseNumbers')
      .optional()
      .isArray({ min: 1 })
      .withMessage('licenseNumbers must be a non-empty array'),
    body('name').optional().isString().withMessage('Name must be a string'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { licenseNumbers, name } = req.body;
      let searchMethod = 'LIC_NBR'; // Default search method is by license number
      let searchCriteria = licenseNumbers;

      // If searching by name, adjust the search method and format the name
      if (name) {
        searchMethod = 'SNDX';
        const nameParts = name.trim().split(/\s+/);
        if (nameParts.length === 2) {
          searchCriteria = `${nameParts[1]}, ${nameParts[0]}`; // Format as 'last name, first name'
        } else {
          searchCriteria = name; // Leave as-is if it's a single word or already in the correct format
        }
      }

      const response = await fetch(
        `https://search-api.dca.ca.gov/licenseSearchService/getPublicLicenseSearch`,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.CALI_API_AUTH}`, // Use environment variable for auth
          },
          method: 'POST',
          body: JSON.stringify({
            clientCode: [],
            searchMethod,
            licenseNumbers:
              searchMethod === 'LIC_NBR' ? searchCriteria : undefined,
            name: searchMethod === 'SNDX' ? searchCriteria : undefined,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`California API responded with ${response.status}`);
      }

      const result = await response.json();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  },
);

// Catch-all route for undefined paths
app.all('*', (req, res) => res.sendStatus(404));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.message || 'Internal Server Error');
  res
    .status(err.status || 500)
    .json({ error: err.message || 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}!`);
  });
}

module.exports = app;
