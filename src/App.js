import React, { useState, useEffect, useCallback } from 'react';

// Main App component
const App = () => {
  // State for general invoice details
  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10), // Default to current date
    vendorName: '',
    deliveryStreet: '', // Changed from deliveryAddress to separate components
    deliveryCity: '',
    deliveryZip: '',
    cdtfaTaxRate: '', // New field for CDTFA tax rate (manual entry or lookup)
    lookupMessage: '', // For displaying lookup status/errors
    applyMarkupToAll: false, // New state for applying markup globally
    globalMarkupPercentage: 0, // New state for global markup percentage
  });

  // State for line items
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      description: '',
      cost: 0,
      markupPercentage: 0,
      salesTaxPercentage: 0,
      calculatedMarkup: 0,
      calculatedSalesTax: 0,
      lineTotal: 0,
    },
  ]);

  // State for summary totals
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalMarkup: 0,
    totalSalesTax: 0,
    grandTotal: 0,
  });

  // Function to handle changes in general invoice details
  const handleInvoiceDetailsChange = (e) => {
    const { name, type, checked, value } = e.target;
    setInvoiceDetails((prevDetails) => ({
      ...prevDetails,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Function to calculate a single line item's values
  const calculateLineItem = useCallback((item, globalMarkup = null) => {
    const cost = parseFloat(item.cost) || 0;
    // Use global markup if applyMarkupToAll is true and globalMarkup is provided, otherwise use item's markup
    const markupPercentage = globalMarkup !== null ? parseFloat(globalMarkup) : parseFloat(item.markupPercentage) || 0;
    const salesTaxPercentage = parseFloat(item.salesTaxPercentage) || 0;

    const calculatedMarkup = cost * (markupPercentage / 100);
    const amountAfterMarkup = cost + calculatedMarkup;
    const calculatedSalesTax = amountAfterMarkup * (salesTaxPercentage / 100);
    const lineTotal = amountAfterMarkup + calculatedSalesTax;

    return {
      ...item,
      calculatedMarkup: parseFloat(calculatedMarkup.toFixed(2)),
      calculatedSalesTax: parseFloat(calculatedSalesTax.toFixed(2)),
      lineTotal: parseFloat(lineTotal.toFixed(2)),
    };
  }, []);

  // Function to handle changes in line item fields
  const handleLineItemChange = useCallback((id, e) => {
    const { name, value } = e.target;
    setLineItems((prevItems) => {
      const updatedItems = prevItems.map((item) =>
        item.id === id ? { ...item, [name]: value } : item
      );
      // Recalculate the specific item immediately after its value changes
      return updatedItems.map((item) =>
        item.id === id ? calculateLineItem(item, invoiceDetails.applyMarkupToAll ? invoiceDetails.globalMarkupPercentage : null) : item
      );
    });
  }, [calculateLineItem, invoiceDetails.applyMarkupToAll, invoiceDetails.globalMarkupPercentage]);

  // Handler for global markup percentage change
  const handleGlobalMarkupChange = (e) => {
    const { value } = e.target;
    setInvoiceDetails((prevDetails) => ({
      ...prevDetails,
      globalMarkupPercentage: value,
    }));
    // Recalculate all line items when global markup changes
    setLineItems((prevItems) =>
      prevItems.map((item) => calculateLineItem(item, value))
    );
  };

  // Effect to recalculate all totals whenever line items or global markup changes
  useEffect(() => {
    let subtotal = 0;
    let totalMarkup = 0;
    let totalSalesTax = 0;
    let grandTotal = 0;

    lineItems.forEach((item) => {
      subtotal += parseFloat(item.cost) || 0;
      totalMarkup += item.calculatedMarkup;
      totalSalesTax += item.calculatedSalesTax;
      grandTotal += item.lineTotal;
    });

    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalMarkup: parseFloat(totalMarkup.toFixed(2)),
      totalSalesTax: parseFloat(totalSalesTax.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    });
  }, [lineItems, invoiceDetails.globalMarkupPercentage, invoiceDetails.applyMarkupToAll, setTotals]);

  // Effect to re-calculate all line items when applyMarkupToAll toggles
  useEffect(() => {
    setLineItems((prevItems) =>
      prevItems.map((item) => calculateLineItem(item, invoiceDetails.applyMarkupToAll ? invoiceDetails.globalMarkupPercentage : null))
    );
  }, [invoiceDetails.applyMarkupToAll, invoiceDetails.globalMarkupPercentage, calculateLineItem]);


  // Function to add a new line item
  const addLineItem = () => {
    setLineItems((prevItems) => [
      ...prevItems,
      {
        id: prevItems.length > 0 ? Math.max(...prevItems.map((item) => item.id)) + 1 : 1,
        description: '',
        cost: 0,
        markupPercentage: 0,
        salesTaxPercentage: 0,
        calculatedMarkup: 0,
        calculatedSalesTax: 0,
        lineTotal: 0,
      },
    ]);
  };

  // Function to remove a line item
  const removeLineItem = (id) => {
    setLineItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  // Function to lookup CDTFA tax rate using Netlify Function
  const handleLookupTaxRate = async () => {
    const { deliveryStreet, deliveryCity, deliveryZip } = invoiceDetails;

    if (!deliveryStreet || !deliveryCity || !deliveryZip) {
      setInvoiceDetails((prev) => ({ ...prev, lookupMessage: 'Please enter a complete address (Street, City, Zip) to look up the tax rate.' }));
      return;
    }

    setInvoiceDetails((prev) => ({ ...prev, lookupMessage: 'Looking up tax rate...' }));

    try {
      // Call your Netlify Function endpoint
      const functionUrl = `/.netlify/functions/getTaxRate?address=${encodeURIComponent(deliveryStreet)}&city=${encodeURIComponent(deliveryCity)}&zip=${encodeURIComponent(deliveryZip)}`;

      const response = await fetch(functionUrl);
      const data = await response.json();

      if (response.ok && data.taxRate) {
        setInvoiceDetails((prev) => ({
          ...prev,
          cdtfaTaxRate: data.taxRate, // Directly use the rate from the function
          lookupMessage: `Tax rate found: ${data.taxRate}%`,
        }));
      } else {
        setInvoiceDetails((prev) => ({
          ...prev,
          cdtfaTaxRate: '', // Clear previous rate
          lookupMessage: data.message || 'Could not find tax rate for the provided address. Please check the address or enter manually.',
        }));
      }
    } catch (error) {
      console.error('Error calling Netlify Function:', error);
      setInvoiceDetails((prev) => ({
        ...prev,
        cdtfaTaxRate: '', // Clear previous rate
        lookupMessage: 'Error fetching tax rate. Please try again later or enter manually.',
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 space-y-8">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-8">
          3rd Party Cross-Billing Calculator
        </h1>

        {/* Invoice Details Section */}
        <div className="bg-indigo-50 p-6 rounded-lg shadow-inner">
          <h2 className="text-2xl font-bold text-indigo-600 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                id="invoiceNumber"
                name="invoiceNumber"
                value={invoiceDetails.invoiceNumber}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="INV-2025-001"
              />
            </div>
            <div>
              <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                id="invoiceDate"
                name="invoiceDate"
                value={invoiceDetails.invoiceDate}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
              />
            </div>
            <div>
              <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Name
              </label>
              <input
                type="text"
                id="vendorName"
                name="vendorName"
                value={invoiceDetails.vendorName}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="Acme Corporation"
              />
            </div>
            {/* Delivery Address Fields */}
            <div>
              <label htmlFor="deliveryStreet" className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Street
              </label>
              <input
                type="text"
                id="deliveryStreet"
                name="deliveryStreet"
                value={invoiceDetails.deliveryStreet}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label htmlFor="deliveryCity" className="block text-sm font-medium text-gray-700 mb-1">
                Delivery City
              </label>
              <input
                type="text"
                id="deliveryCity"
                name="deliveryCity"
                value={invoiceDetails.deliveryCity}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="Anytown"
              />
            </div>
            <div className="flex items-end">
              <div className="flex-grow">
                <label htmlFor="deliveryZip" className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Zip
                </label>
                <input
                  type="text"
                  id="deliveryZip"
                  name="deliveryZip"
                  value={invoiceDetails.deliveryZip}
                  onChange={handleInvoiceDetailsChange}
                  className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                  placeholder="90210"
                />
              </div>
              <button
                onClick={handleLookupTaxRate}
                className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 self-end"
              >
                Lookup
              </button>
            </div>
            <div className="lg:col-span-3 text-center">
              <label htmlFor="cdtfaTaxRate" className="block text-sm font-medium text-gray-700 mb-1">
                CDTFA Tax Rate (%)
              </label>
              <input
                type="number"
                id="cdtfaTaxRate"
                name="cdtfaTaxRate"
                value={invoiceDetails.cdtfaTaxRate}
                onChange={handleInvoiceDetailsChange}
                className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                placeholder="e.g., 7.25"
                min="0"
                step="0.001" // Allow for higher precision
              />
              {invoiceDetails.lookupMessage && (
                <p className="text-sm mt-1 text-gray-600">{invoiceDetails.lookupMessage}</p>
              )}
            </div>
            {/* New Markup Control */}
            <div className="lg:col-span-3 flex items-center mt-4">
              <input
                type="checkbox"
                id="applyMarkupToAll"
                name="applyMarkupToAll"
                checked={invoiceDetails.applyMarkupToAll}
                onChange={handleInvoiceDetailsChange}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="applyMarkupToAll" className="ml-2 block text-sm font-medium text-gray-700">
                Apply Markup Percentage to All Lines
              </label>
              {invoiceDetails.applyMarkupToAll && (
                <div className="ml-4 flex-grow">
                  <label htmlFor="globalMarkupPercentage" className="sr-only">Global Markup (%)</label>
                  <input
                    type="number"
                    id="globalMarkupPercentage"
                    name="globalMarkupPercentage"
                    value={invoiceDetails.globalMarkupPercentage}
                    onChange={handleGlobalMarkupChange}
                    className="w-full p-2 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                    placeholder="Global Markup (%)"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-indigo-600">Line Items</h2>
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-200 relative group"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label htmlFor={`description-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    id={`description-${item.id}`}
                    name="description"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(item.id, e)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
                    placeholder="Service Fee / Product Cost"
                  />
                </div>
                <div>
                  <label htmlFor={`cost-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Cost ($)
                  </label>
                  <input
                    type="number"
                    id={`cost-${item.id}`}
                    name="cost"
                    value={item.cost}
                    onChange={(e) => handleLineItemChange(item.id, e)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor={`markupPercentage-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Markup (%)
                  </label>
                  <input
                    type="number"
                    id={`markupPercentage-${item.id}`}
                    name="markupPercentage"
                    value={invoiceDetails.applyMarkupToAll ? invoiceDetails.globalMarkupPercentage : item.markupPercentage}
                    onChange={(e) => handleLineItemChange(item.id, e)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    disabled={invoiceDetails.applyMarkupToAll} // Disable if global markup is applied
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Markup: ${item.calculatedMarkup.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label htmlFor={`salesTaxPercentage-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Sales Tax (%)
                  </label>
                  <input
                    type="number"
                    id={`salesTaxPercentage-${item.id}`}
                    name="salesTaxPercentage"
                    value={item.salesTaxPercentage}
                    onChange={(e) => handleLineItemChange(item.id, e)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tax: ${item.calculatedSalesTax.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col justify-end">
                  <p className="block text-sm font-medium text-gray-700 mb-1">Line Total:</p>
                  <p className="text-lg font-semibold text-indigo-700">${item.lineTotal.toFixed(2)}</p>
                </div>
              </div>
              {lineItems.length > 1 && (
                <button
                  onClick={() => removeLineItem(item.id)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remove line item"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addLineItem}
            className="flex items-center justify-center w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Line Item
          </button>
        </div>

        {/* Summary Section */}
        <div className="bg-indigo-50 p-6 rounded-lg shadow-inner mt-8">
          <h2 className="text-2xl font-bold text-indigo-600 mb-4">Summary</h2>
          <div className="space-y-2 text-lg">
            <div className="flex justify-between">
              <span>Subtotal (Base Costs):</span>
              <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Markup:</span>
              <span className="font-semibold">${totals.totalMarkup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Sales Tax:</span>
              <span className="font-semibold">${totals.totalSalesTax.toFixed(2)}</span>
            </div>
            <div className="border-t border-indigo-300 pt-4 mt-4 flex justify-between text-2xl font-bold text-indigo-800">
              <span>Grand Total:</span>
              <span>${totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Optional: Print/Save) */}
        <div className="flex justify-end mt-8 space-x-4">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-200"
          >
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
