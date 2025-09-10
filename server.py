from flask import Flask, request, jsonify
import requests
import hmac
import hashlib
import smtplib
from email.mime.text import MIMEText
import os

app = Flask(__name__)

# 🔑 Environment variables
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_EMAIL_PASSWORD = os.getenv("ADMIN_EMAIL_PASSWORD")  # Gmail app password
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587


def send_email(subject, body, to_email):
    """Send an email via SMTP"""
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = ADMIN_EMAIL
        msg["To"] = to_email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(ADMIN_EMAIL, ADMIN_EMAIL_PASSWORD)
            server.sendmail(ADMIN_EMAIL, [to_email], msg.as_string())
            print(f"📧 Email sent to {to_email}")
    except Exception as e:
        print(f"❌ Error sending email: {e}")


@app.route("/", methods=["GET"])
def home():
    return "Flask Paystack Server is running!"


@app.route("/initialize-payment", methods=["POST"])
def initialize_payment():
    data = request.json
    amount = data.get("amount")
    buyer_number = data.get("buyerNumber")
    recipient_number = data.get("recipientNumber")
    plan = data.get("plan")

    # Paystack requires email → generate dummy email from buyer number
    dummy_email = f"{buyer_number}@buyer.bangerhitz.com"

    url = "https://api.paystack.co/transaction/initialize"
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "amount": amount * 100,  # Paystack uses kobo/pesewas
        "email": dummy_email,
        "metadata": {
            "custom_fields": [
                {"display_name": "Buyer Phone", "variable_name": "buyer_number", "value": buyer_number},
                {"display_name": "Recipient Phone", "variable_name": "recipient_number", "value": recipient_number},
                {"display_name": "Selected Plan", "variable_name": "selected_plan", "value": plan}
            ]
        }
    }

    try:
        response = requests.post(url, headers=headers, json=body)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/webhook", methods=["POST"])
def paystack_webhook():
    signature = request.headers.get("x-paystack-signature")
    payload = request.get_data()

    # ✅ Verify webhook signature
    expected_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()

    if signature != expected_signature:
        return jsonify({"error": "Invalid signature"}), 400

    event = request.json
    if event.get("event") == "charge.success":
        tx_data = event["data"]
        amount = tx_data["amount"] / 100
        reference = tx_data["reference"]

        buyer_number = None
        recipient_number = None
        selected_plan = None

        for field in tx_data["metadata"]["custom_fields"]:
            if field["variable_name"] == "buyer_number":
                buyer_number = field["value"]
            elif field["variable_name"] == "recipient_number":
                recipient_number = field["value"]
            elif field["variable_name"] == "selected_plan":
                selected_plan = field["value"]

        # --- Email Notifications ---
        # Admin email
        admin_msg = f"""
        ✅ New Payment Received

        Plan: {selected_plan}
        Recipient: {recipient_number}
        Buyer: {buyer_number}
        Amount: {amount} GHS
        Transaction ID: {reference}
        """
        send_email("New Payment Received", admin_msg, ADMIN_EMAIL)

        # Buyer receipt
        buyer_email = f"{buyer_number}@buyer.bangerhitz.com"
        buyer_msg = f"""
        🎉 Thank you for your purchase!

        Your data bundle has been successfully paid.

        Plan: {selected_plan}
        Recipient: {recipient_number}
        Amount: {amount} GHS
        Transaction ID: {reference}
        """
        send_email("Payment Receipt - BangerHitz", buyer_msg, buyer_email)

    return jsonify({"status": "success"}), 200


if __name__ == "__main__":
    app.run(port=3000, debug=True)
