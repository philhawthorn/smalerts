import * as https from 'https'
import nodemailer from 'nodemailer'
import * as dotenv from 'dotenv'
dotenv.config();

const highWaterMarkElectricity = JSON.parse( process.env.HIGH_WATERMARK_ELECTRICITY || `{"01": 400, "02": 350, "03": 300, "04": 250, "05": 200, "06": 200, "07": 200, "08": 200, "09": 300, "10": 450, "11": 475, "12": 500}` );
const highWaterMarkGas = JSON.parse( process.env.HIGH_WATERMARK_GAS || `{"01": 400, "02": 350, "03": 300, "04": 250, "05": 200, "06": 200, "07": 200, "08": 200, "09": 300, "10": 450, "11": 475, "12": 500}` );

const { ALERT_RECIPIENTS, API_AUTH, SMTP_HOST, SMTP_PASS, SMTP_USER, PRICE_ELECTRICITY, PRICE_GAS, SMTP_PORT=587, HIGH_USAGE_ONLY=false } = process.env;

const isInDebug = process.env.TERM_PROGRAM === 'vscode'


const createSmtpTransport = () => {
    const smtpOptions = {
        host: SMTP_HOST,
        port: SMTP_PORT,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    }
    return nodemailer.createTransport(smtpOptions)
}

const transport = createSmtpTransport();
const reportedElectricity = []
const reportedGas = []

const getUsageData = (type,yyyy,mm,dd) => {
    const options = {
        host: `consumer-api.data.n3rgy.com`,
        path: `/${type}/consumption/1?start=${yyyy}${mm}${dd}0000&end=${yyyy}${mm}${dd}2330`,
        port: 443,
        method: 'GET',
        headers: {
            'Authorization': API_AUTH,
            'Accept': '*/*'
        }
    }

    return new Promise((resolve, reject) => {
        const req = https.get(options, (res)=>{
            const msg = [];
            let result;
            res.setEncoding('utf-8')
            res.on('data', function(chunk) {
                msg.push(chunk);
            });
            res.on('end', function() {
                try {
                    resolve(JSON.parse(msg.join('')))
                } catch(e) {
                    // msg isn't JSON, so we need to see the underlying message from the server
                    console.error(msg)
                    reject(e)
                }
            });
        })
    })
}

const generateTable = (data, price, adjustment=(val)=>val*1) => {
    const cumulativeUsage = data.values.reduce((cumm, record)=>{
        return cumm+=adjustment(+record.value)
    }, 0)

    const cumulativeCost = data.values.reduce((cumm, record)=>{
        return cumm+=adjustment(record.value)*price
    }, 0)

    return [["Timestamp", "Usage", "Unit", "Cost"]].concat(data.values.map(row=>[row.timestamp, row.value])).map((row,index,array)=>{
        return index === 0
            ? `<table><tr><th>${row[0]}</th><th>${row[1]}</th><th>${row[2]}</th><th>${row[3]}</th></tr>`
            : index+1 < array.length
                ? `<tr><td>${row[0]}</td><td>${adjustment(row[1]).toFixed(3)}</td><td>kWh</td><td>£${(adjustment(row[1])*price).toFixed(2)}</td></tr>`
                : `<tr><th>Total Usage</th><th>${cumulativeUsage.toFixed(3)}</th><th>kWh</th><th>£${cumulativeCost.toFixed(2)}</th></tr></table>`
    }).join('')
}

const processInterval = async () => {

    const now = new Date();

    console.log(`Running Interval ${now}`)

    if(now.getMinutes() === 0 || now.getMinutes() === 30 || isInDebug) {

        const yyyy = now.getFullYear();
        const mm = `${now.getMonth()+1}`.padStart(2, '0');
        const dd = `${now.getDate()}`.padStart(2, '0');

        const highUsageElec = +highWaterMarkElectricity[mm];
        const highUsageGas = +highWaterMarkGas[mm];

        const elecUsageData = await getUsageData('electricity', yyyy, mm, dd)
        const gasUsageData = await getUsageData('gas', yyyy, mm, dd)

        if(!elecUsageData || !gasUsageData) {
            console.log(`Failed to fetch data from n3rgy`)
            return;
        }

        const elecUsageTable = generateTable(elecUsageData, +PRICE_ELECTRICITY);
        // Gas adjustment: Volume Correction (for temperature and pressure) * Calorific Value (energy in each m3 of gas) / 3.6 (convert from joules)
        const gasAdjustment = val=>val*1.02264*39.7/3.6;
        const gasUsageTable = generateTable(gasUsageData, +PRICE_GAS, gasAdjustment);

        const lastElectrictyEntry = elecUsageData.values[elecUsageData.values.length-1]
        const lastGasEntry = gasUsageData.values[gasUsageData.values.length-1]

        const createSubject = () => {
            return (+lastElectrictyEntry.value)*1000 > highUsageElec || gasAdjustment(+lastGasEntry.value)*1000 > highUsageGas ? '*HIGH* Energy Usage Alert! ⚡️🔥' : 'Energy Usage Alert ⚡️🔥';
        }


        if(!reportedElectricity.includes(lastElectrictyEntry.timestamp) || !reportedGas.includes(lastGasEntry.timestamp)) {

            const subject = createSubject();

            if(!reportedElectricity.includes(lastElectrictyEntry.timestamp) ) {
                reportedElectricity.push(lastElectrictyEntry.timestamp)
            }

            if(!reportedGas.includes(lastGasEntry.timestamp)) {
                reportedGas.push(lastGasEntry.timestamp)
            }

            transport.sendMail({
                from: SMTP_USER,
                to: ALERT_RECIPIENTS,
                subject: subject,
                html: `<head><style>th {text-align: left;} th,td {padding: 5px}</style></head><h1>Electricity ⚡️:</h1>${elecUsageTable}<br/><h1>Gas 🔥:</h1>${gasUsageTable}`
            }, function(err, info) {
                if (err) {
                    console.log(err)
                } 
                if(info) {
                    console.log('Sent alert.')
                }
            })                        
        } else {
            console.log('Latest data already reported.');
        }
    }
}

processInterval().then(()=>{
    // process every minute to check time is on, or half past the hour
    setInterval(processInterval, 1000*60)
});

