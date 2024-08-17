require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, query, validationResult } = require('express-validator');

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
        `https://data.illinois.gov/api/3/action/datastore_search?resource_id=fecd51fd-830f-4245-b4e0-9d952992f855&q=${req.query.q}`
      );
      if (!response.ok) {
        throw new Error(`Illinois API responded with ${response.status}`);
      }
      const result = await response.json();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  }
);

// /cali-api endpoint with input validation, secure auth, and error handling
app.post(
  '/cali-api',
  [
    body('licenseNumbers')
      .isArray({ min: 1 })
      .withMessage('licenseNumbers must be a non-empty array'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { licenseNumbers } = req.body;
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
            clientCode: ['8002', '4004'],
            searchMethod: 'LIC_NBR',
            licenseNumbers,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`California API responded with ${response.status}`);
      }

      const result = await response.json();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  }
);

// Catch-all route for undefined paths
app.all('*', (req, res) => res.sendStatus(404));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.message || 'Internal Server Error');
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}!`);
  });
}

module.exports = app;
