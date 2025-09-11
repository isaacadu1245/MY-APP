import os
import json
import hmac
import hashlib
import requests

# This function will handle the incoming webhook from Paystack.
# It's designed to be deployed as a serverless function (e.g., on Vercel or a similar platform).
def handler(request, response):
    """
    Handles incoming webhook requests from Paystack.

    This function performs the following steps:
    1. Validates the request by verifying the signature using the PAYSTACK_SECRET_KEY.
    2. Parses the JSON payload from the request body.
    3. Checks if the event type is a successful charge ('charge.success').
    4. Extracts transaction details from the payload metadata.
    5. Calls the DataMart API to purchase the data bundle for the user.
    6. Returns an HTTP 200 status code to acknowledge the webhook.
    """

    # Retrieve the Paystack secret key from environment variables for security.
    paystack_secret = os.getenv("PAYSTACK_SECRET_KEY")
    if not paystack_secret:
        return {'status': 'error', 'message': 'Paystack secret key not found.'}, 500

    # Retrieve the DataMart API key from environment variables.
    datamart_api_key = os.getenv("DATAMART_API_KEY")
    if not datamart_api_key:
        return {'status': 'error', 'message': 'DataMart API key not found.'}, 500

    # Read the raw request body and get the signature from the headers.
    payload = request.get_data()
    paystack_sig = request.headers.get("x-paystack-signature")

    # 1. Verify the webhook signature to ensure it's from Paystack.
    computed_signature = hmac.new(
        paystack_secret.encode('utf-8'),
        payload,
        hashlib.sha512
    ).hexdigest()

    if computed_signature != paystack_sig:
        # Signature mismatch, return a 401 Unauthorized error.
        print("Webhook signature verification failed.")
        return {'status': 'error', 'message': 'Signature verification failed.'}, 401

    # 2. Parse the JSON payload.
    try:
        event = json.loads(payload.decode('utf-8'))
    except json.JSONDecodeError:
        print("Invalid JSON payload.")
        return {'status': 'error', 'message': 'Invalid JSON payload.'}, 400

    # 3. Process only 'charge.success' events.
    if event.get('event') == 'charge.success':
        # 4. Extract data from the webhook payload.
        # This data comes from the metadata field you passed to Paystack.
        metadata = event.get('data', {}).get('metadata', {})
        recipient_phone = metadata.get('recipientNumber')
        data_plan_name = metadata.get('selectedPlanName')

        if not recipient_phone or not data_plan_name:
            print("Missing recipient phone or data plan in metadata.")
            return {'status': 'error', 'message': 'Missing required metadata.'}, 400

        print(f"Charge successful for {recipient_phone} for plan: {data_plan_name}. Processing data bundle purchase.")

        # 5. Call the DataMart API to purchase the data bundle.
        # This is where you would integrate with your DataMart provider's API.
        # Replace the URL and payload with the actual API details.
        datamart_api_url = "https://api.datamart.com/purchase" # Placeholder URL

        api_payload = {
            "api_key": datamart_api_key,
            "recipient_phone": recipient_phone,
            "data_plan_name": data_plan_name
            # Include any other necessary parameters for the DataMart API.
        }

        try:
            # Send the request to the DataMart API.
            api_response = requests.post(datamart_api_url, json=api_payload)
            api_response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

            print(f"DataMart API response: {api_response.status_code}")
            return {'status': 'success', 'message': 'Data bundle purchased successfully.'}, 200

        except requests.exceptions.RequestException as e:
            print(f"Failed to call DataMart API: {e}")
            return {'status': 'error', 'message': f'DataMart API call failed: {e}'}, 500

    else:
        # Ignore other webhook events.
        print(f"Ignoring event type: {event.get('event')}")
        return {'status': 'ignored', 'message': 'Event type ignored.'}, 200

    return {'status': 'ok', 'message': 'Request received and processed.'}, 200
