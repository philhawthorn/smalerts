import * as https from 'https'
import nodemailer from 'nodemailer'
import * as dotenv from 'dotenv'
dotenv.config();

const highWaterMark = JSON.parse( process.env.HIGH_WATERMARK || `{"01": 400, "02": 350, "03": 300, "04": 250, "05": 200, "06": 200, "07": 200, "08": 200, "09": 300, "10": 450, "11": 475, "12": 500}` );

const smptOptions = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
}

const transport = nodemailer.createTransport(smptOptions)
transport.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ALERT_RECIPIENTS,
    subject: 'Test alert',
    text: 'This is a test to see if the SMTP service is working. Alerts will be sent throughout the day.'
}, function(err, info) {
    if (err) {
        console.log(err)
    } 
    if(info) {
        console.log('Sent test')
    }
})


const reported = []


setInterval(()=>{

    const now = new Date();

    console.log(`Running Interval ${now}`)

    if(now.getMinutes() === 0 || now.getMinutes() === 30) {

        const yyyy = now.getFullYear();
        const mm = `${now.getMonth()+1}`.padStart(2, '0');
        const dd = `${now.getDate()}`.padStart(2, '0');

        const highUsage = +highWaterMark[mm];

        const options = {
            host: `consumer-api.data.n3rgy.com`,
            path: `/electricity/consumption/1?start=${yyyy}${mm}${dd}0000&end=${yyyy}${mm}${dd}2330`,
            port: 443,
            method: 'GET',
            headers: {
                'Authorization': process.env.API_AUTH,
                'Accept': '*/*'
            }
        }
    
        const req = https.get(options, (res)=>{
            let msg = '';
            let result;
            res.setEncoding('utf-8')
            res.on('data', function(chunk) {
                msg += chunk;
            });
            res.on('end', function() {
                try {
                    result = JSON.parse(msg)
                    const lastEntry = result.values[result.values.length-1];
                    if(!reported.includes(lastEntry.timestamp)) {

                        const subject = `${+(lastEntry.value*1000) >= highUsage ? 'HIGH ' : ''}Usage Alert: ${lastEntry.timestamp}, ${lastEntry.value}`;
                        reported.push(lastEntry.timestamp)

                        transport.sendMail({
                            from: process.env.SMTP_USER,
                            to: process.env.ALERT_RECIPIENTS,
                            subject: subject,
                            text: result.values.map(row=>{
                                return `${row.timestamp}, ${row.value}`
                            }).join('\n')
                        }, function(err, info) {
                            if (err) {
                                console.log(err)
                            } 
                            if(info) {
                                console.log('Sent alert.')
                            }
                        })                        


                    }

                } catch(e) {
                    // msg isn't JSON, so we need to see the underlying message from the server
                    console.error(msg)
                    throw e;
                }
            });
        })
    
    }

}, 1000*60)
