from flask import Flask, request

app = Flask(__name__)

VERIFY_TOKEN = "my_webhook_token"

@app.route("/webhook", methods=["GET"])
def verify():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return challenge, 200
    return "Verification failed", 403


@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.json
    print("Webhook data:", data)

    try:
        button = data["entry"][0]["changes"][0]["value"]["messages"][0]["button"]["payload"]

        if button == "approve_leave":
            print("Leave Approved")

        elif button == "reject_leave":
            print("Leave Rejected")

    except:
        pass

    return "OK", 200


if __name__ == "__main__":
    app.run(port=5000)