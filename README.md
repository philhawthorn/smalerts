# Smart Meter Email Alerts

Node.js app to retrieve half-hourly data from your Smart Meter to keep abreast of energy usage throughout the day.

## Setup:

1. Register at https://data.n3rgy.com/consumer/home. To register, you'll need your MPAN/MPxN number (from your bill) and your GUID (excluding -'s) from your Smart Meter.
2. Access to an SMTP server - I used ```smtp.gmail.com```, need to setup an App password for it to work.
3. A ```.env``` file in the root, containing the following:

```SMTP_HOST``` e.g. smtp.gmail.com

```SMTP_USER``` e.g. your gmail address

```SMTP_PASS``` e.g. your app password for gmail

```SMTP_PORT``` defaults to ```587```

```API_AUTH``` i.e. your GUID from your smart meter (excluding -'s)

```ALERT_RECIPIENTS``` e.g. comma separated list of recipient email address(es)

```HIGH_WATERMARK_ELECTRICITY``` i.e. what you consider high usage for a 30 minute period (in watts) for each month, expressed as JSON, e.g. ```{ "01": 300, "02": 400 }``` where "01" is January, "02" is February etc.

```HIGH_WATERMARK_GAS``` i.e. what you consider high usage for a 30 minute period (in watts) for each month, expressed as JSON, e.g. ```{ "01": 300, "02": 400 }``` where "01" is January, "02" is February etc.

```PRICE_ELECTRICITY``` e.g. price in pence of a kWh of Electricity

```PRICE_GAS``` e.g. price in pence of a kWh of Gas

Optional ```HIGH_USAGE_ONLY``` send only high usage alerts, defaults to ```false```

## Start process locally

```npm start```

## Deployment to heroku

Connect repo to heroku and deploy. The Procfile will start a heroku worker, note free tier will go to sleep after 30 mins. 

Note, there is a delay of a couple of hours in the data syncing to n3rgy so not exactly real-time.


