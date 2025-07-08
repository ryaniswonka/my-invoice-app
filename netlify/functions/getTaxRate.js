// netlify/functions/getTaxRate.js

// This is a Netlify Function that acts as a proxy to the CDTFA Tax Rate API.
// It bypasses CORS issues by making the request from the server-side (Netlify's infrastructure).

exports.handler = async (event, context) => {
  // Ensure this function only responds to GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  // Extract query parameters from the request from the frontend
  const { address, city, zip } = event.queryStringParameters;

  // Basic validation for required parameters
  if (!address || !city || !zip) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing address, city, or zip query parameters.' }),
    };
  }

  try {
    // Construct the URL for the external CDTFA API
    // Ensure parameters are properly URL-encoded
    const apiUrl = `https://services.maps.cdtfa.ca.gov/api/taxrate/GetRateByAddress?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&zip=${encodeURIComponent(zip)}`;

    // Make the request to the CDTFA API
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Check if the API returned a valid tax rate
    if (response.ok && data && data.taxRateInfo && data.taxRateInfo.length > 0 && typeof data.taxRateInfo[0].rate === 'number') {
      const taxRate = data.taxRateInfo[0].rate * 100; // Convert from decimal to percentage
      return {
        statusCode: 200,
        body: JSON.stringify({ taxRate: taxRate.toFixed(3) }), // Return as a string with 3 decimal places
      };
    } else {
      // Handle cases where the API call was successful but no valid tax rate was found
      return {
        statusCode: 404,
        body: JSON.stringify({ message: data.message || 'Could not find tax rate for the provided address.' }),
      };
    }
  } catch (error) {
    // Handle network errors or other exceptions during the fetch
    console.error('Error fetching tax rate from CDTFA API:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error: Failed to fetch tax rate.' }),
    };
  }
};
