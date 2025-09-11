import fetch from 'node-fetch'; // Vercel has node-fetch available by default

// This function will be your secure backend logic.
// It will run on Vercel's server and have access to environment variables.
export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  // Extract the transaction reference from the client-side request body
  const { reference, plan_details, recipient_number, buyer_number, payment_method } = req.body;

  if (!reference) {
    return res.status(400).json({ status: 'error', message: 'Missing transaction reference' });
  }

  // Retrieve the secret key from your environment variables.
  // DO NOT hardcode this value.
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const FORMSPREE_URL = process.env.FORMSPREE_URL;

  if (!PAYSTACK_SECRET_KEY || !FORMSPREE_URL) {
    console.error('Missing environment variables!');
    return res.status(500).json({ status: 'error', message: 'Server configuration error.' });
  }

  try {
    // 1. Verify the transaction with Paystack's API
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      }
    });

    const paystackData = await paystackResponse.json();

    // Check if the Paystack verification was successful
    if (!paystackData.status || paystackData.data.status !== 'success') {
      console.error('Paystack verification failed:', paystackData);
      return res.status(400).json({ status: 'error', message: 'Payment verification failed with Paystack.' });
    }

    // 2. Submit the verified data to Formspree
    const formData = {
      plan_name: plan_details.name,
      plan_price: paystackData.data.amount / 100, // Convert Kobo/Pesewas back to GHC
      recipient_number: recipient_number,
      buyer_number: buyer_number,
      payment_method: payment_method,
      paystack_reference: reference,
      paystack_status: 'success'
    };

    const formspreeResponse = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!formspreeResponse.ok) {
      console.error('Formspree submission failed:', await formspreeResponse.text());
      // Log the error but still tell the user the payment was successful
      // as the payment itself is verified.
    }

    // 3. Send a success response back to the client
    res.status(200).json({ status: 'success', message: 'Payment verified and form submitted.' });

  } catch (error) {
    console.error('Server error during payment verification:', error);
    res.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
  }
}

