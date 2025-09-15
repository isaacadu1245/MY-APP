const https = require('https');

// This function is for a Vercel serverless environment.
// It handles POST requests from the client.
module.exports = async (req, res) => {
  try {
    // 1. Get transaction reference from the client request
    const { reference, plan_details, recipient_number, buyer_number, payment_method } = req.body;

    if (!reference) {
      console.error('Error: Transaction reference is missing.');
      return res.status(400).json({ status: 'error', message: 'Transaction reference is missing.' });
    }

    // Use the secret key from environment variables
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const formspreeUrl = process.env.FORMSPREE_URL;

    // 2. Contact Paystack to verify the payment
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${encodeURIComponent(reference)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    };

    const paystackReq = https.request(options, paystackRes => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', async () => {
        try {
          const result = JSON.parse(data);

          if (result.data && result.data.status === 'success') {
            try {
              // 3. Submit the verified data to Formspree
              const formData = {
                plan_name: plan_details.name,
                plan_price: result.data.amount / 100, // Paystack returns amount in kobo/pesewas
                recipient_number: recipient_number,
                buyer_number: buyer_number,
                payment_method: payment_method,
                paystack_status: 'success',
                paystack_reference: reference
              };

              const formspreeResponse = await fetch(formspreeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
              });

              if (!formspreeResponse.ok) {
                console.error('Formspree submission failed:', await formspreeResponse.text());
                return res.status(200).json({ status: 'success', message: 'Payment verified and form submitted. But something went wrong with the form.' });
              }

              // 4. Send a success response back to the client
              res.status(200).json({ status: 'success', message: 'Payment verified and form submitted.' });
            } catch (error) {
              console.error('Error submitting to Formspree:', error);
              res.status(500).json({ status: 'error', message: 'An internal server error occurred during form submission.' });
            }

          } else {
            // Payment failed or was not successful
            console.error('Payment verification failed:', result.message);
            res.status(400).json({ status: 'error', message: 'Payment verification failed.' });
          }
        } catch (parseError) {
          console.error('Error parsing Paystack response:', parseError);
          res.status(500).json({ status: 'error', message: 'An internal server error occurred while parsing response.' });
        }
      });
    });

    paystackReq.on('error', (error) => {
      console.error('Error contacting Paystack:', error);
      res.status(500).json({ status: 'error', message: 'Could not contact Paystack for verification.' });
    });

    paystackReq.end();

  } catch (outerError) {
    console.error('An unexpected error occurred:', outerError);
    res.status(500).json({ status: 'error', message: 'An unexpected server error occurred.' });
  }
};
