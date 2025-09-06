// server.js (updated section)

// ... other code above ...

app.post('/process-payment', async (req, res) => {
    console.log('Received form data:', req.body);

    const {
        'Data Plan': dataPlan,
        'Recipient Phone': recipientPhone,
        'Buyer Phone': buyerPhone,
        'Payment Method': paymentMethod
    } = req.body;

    // Extract the price from the data plan string
    const priceMatch = dataPlan.match(/GHC (\d+\.\d{2})/);
    const amount = priceMatch ? parseFloat(priceMatch[1]) : null;

    if (!amount) {
        return res.status(400).json({ status: 'error', message: 'Invalid data plan or price.' });
    }

    // Hubtel API Integration
    const hubtelApiKey = process.env.HUBTEL_API_KEY;
    const hubtelClientSecret = process.env.HUBTEL_CLIENT_SECRET;
    const hubtelPaymentUrl = 'https://api.hubtel.com/v1/merchantaccount/merchants/{{your-merchant-id}}/receive/mobilemoney';

    const hubtelPayload = {
        amount: amount,
        customerMsisdn: buyerPhone,
        channel: paymentMethod,
        description: `Payment for ${dataPlan}`,
        callbackUrl: 'https://your-server.vercel.app/hubtel-callback' // A URL for Hubtel to notify you of payment status
    };

    try {
        const hubtelResponse = await fetch(hubtelPaymentUrl, {
            method: 'POST',
            body: JSON.stringify(hubtelPayload),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${hubtelApiKey}:${hubtelClientSecret}`).toString('base64')
            }
        });

        const hubtelResult = await hubtelResponse.json();
        console.log('Hubtel API Response:', hubtelResult);

        // You would handle success/failure here.
        // If successful, continue to Formspree submission.

        // ... Formspree submission code ...

        // Send a success message back to your website
        res.status(200).json({ status: 'success', message: 'Payment prompt sent!' });

    } catch (error) {
        console.error('Hubtel API error:', error);
        res.status(500).json({ status: 'error', message: 'Payment processing failed.' });
    }
});

// ... other code below ...
