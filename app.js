// const express = require('express')
import express from "express";
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer';
import nodecron from 'node-cron';
import fs from 'node:fs/promises';
import { readFile } from "node:fs";

const sleep = (millsec) => {
  return new Promise( (resolve) => setTimeout(resolve,millsec));
} 

let resetCookieCount = 0; 


// const baseApiUrl = 'http://127.0.0.1:8000/api/'; // LOCALdd
const baseApiUrl = 'https://superadmin.samicsub.com/api/'; // LIVE


//nodecron starts hereeooo
// 0 */45 * * * *
// The ranges are here.
// Seconds: 0-59
// Minutes: 0-59
// Hours: 0-23
// Day of Month: 1-31
// Months: 0-11
// Day of Week: 0-6
// nodecron.schedule("*/10 * * * * *", vendingFunction);
// nodecron.schedule("0 */1 * * * *", getDataBalance);
//nodecron ends hereskol

// while(true){
//     console.log("Start vending")
//     vendingFunction().then(()=>console.log('done')).catch((err)=>console.log(err))
// }




//cron to get databalance exclusively
async function getDataBalance(txnId,balanceType){
  // const browser = await puppeteer.launch({headless: false,  defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
    console.log("getting data balance", balanceType)
    // const browser = await puppeteer.launch({headless: false,  defaultViewport: null});
    console.log(browser)
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 1024}); 
   
    const cookiesString = await fs.readFile('./cookies.json');
    const cookiesSet = JSON.parse(cookiesString);
    await page.setCookie(...cookiesSet);

    await page.goto('https://selfcare.ng.airtel.com:1013/EducationSuite/Contract/Balance',{ timeout: 0, waitUntil: 'networkidle0' });
    // await page.waitForNavigation(0);


    //shows the page auth failed, no cookie is availables
    // if (getCookie('edusuite') === null) {
    if (await page.$('#tblpaymentHistory_filter') == null) {
      console.log('SET COOKIE for balance');

      await page.goto('https://selfcare.ng.airtel.com:1013/educationsuite/account/login/?ReturnUrl=%2FEducationSuite%2FHome%2FBundleRequest%3F',{ waitUntil: 'networkidle0' });
      // await page.waitForNavigation(0);


      await page.waitForSelector('#ContractNumber');
      await page.type('#ContractNumber', '3730832361');
      await page.waitForSelector('#Password');
      await page.type('#Password', 'Vend@100');
      await page.waitForSelector('#btnSave');
      await page.click('#btnSave');
  
      // await sleep(3000)
      //save cookies
      const cookies = await page.cookies();
      await fs.writeFile('./cookies.json',JSON.stringify(cookies,null,2)); 

      const cookiesString = await fs.readFile('./cookies.json');
      const cookiesSet = JSON.parse(cookiesString);
      await page.setCookie(...cookiesSet);
      // await browser.close();

      return { 'status' : 'authenticating','message' : 'setting cookie' };

    }else{
      console.log('COOKIE IS ACTIVE for balance');
      resetCookieCount = 0;
      await sleep(2000)
    
      await page.waitForSelector('#content > div > div.container-fluid > div > div:nth-child(2) > div > div > div > div.col.mr-2 > div.text-xs.font-weight-bold.text-success.text-uppercase.mb-1 > span');

      //now get, balanced
      const response = await page.$("#content > div > div.container-fluid > div > div:nth-child(2) > div > div > div > div.col.mr-2 > div.text-xs.font-weight-bold.text-success.text-uppercase.mb-1 > span")
      let dataBalance= await (await response.getProperty('textContent')).jsonValue();
      dataBalance = dataBalance.replaceAll(',', '');
      dataBalance = dataBalance.replaceAll('GB', '');
      dataBalance = dataBalance.replaceAll(' ', '');
      dataBalance = dataBalance.replaceAll('(', '');
      dataBalance = dataBalance.replaceAll(')', '');
      console.log(`Data balance: ${balanceType}`,dataBalance); 
     
      //log to server
      const data = new URLSearchParams();
      data.append('network', 'airtel');
      data.append('balance', dataBalance);
      data.append('balance_type', balanceType);  //balance type is 'after' OR 'before's
      data.append('transaction_id', txnId);
      console.log('balance was logged');

      await fetch(`${baseApiUrl}fetch-and-save-airtel-balance`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
        },
        body: data
      })
      .then(response => response.json())
      .then(response => {
          console.log(response.message);
      });
      await browser.close();
    }
}


//entire vending function
async function vendingFunction(){
  // const sleep = (millsec) => {
  //   return new Promise( (resolve) => setTimeout(resolve,millsec));
  // } 
  const browser = await puppeteer.launch({headless: false,  defaultViewport: null});


  const date = new Date();
    
  // Function to convert 
  // single digit input 
  // to two digits 
  const formatData = (input) => { 
    if (input > 9) { 
      return input; 
    } else return `0${input}`; 
  }; 
    
  // Function to convert 
  // 24 Hour to 12 Hour clock 
  const formatHour = (input) => { 
    if (input > 12) { 
      return input - 12; 
    } 
    return input; 
  }; 


  const format = { 
    dd: formatData(date.getDate()), 
    mm: formatData(date.getMonth() + 1), 
    yyyy: date.getFullYear(), 
    HH: formatData(date.getHours()), 
    hh: formatData(formatHour(date.getHours())), 
    MM: formatData(date.getMinutes()), 
    SS: formatData(date.getSeconds()), 
  }; 


  const format24Hour = ({ dd, mm, yyyy, HH, MM, SS }) => { 
    return `${dd}-${mm}-${yyyy} ${HH}:${MM}:${SS}`; 

  }; 
  const format12Hour = ({ dd, mm, yyyy, hh, MM, SS }) => { 
    // console.log(`${mm}/${dd}/${yyyy} ${hh}:${MM}:${SS}`); 
    return `${dd}-${mm}-${yyyy} ${hh}:${MM}:${SS}`; 
  }; 
    
  // // Time in 24 Hour format 
  // format24Hour(format); 
  // // Time in 12 Hour format 
  // format12Hour(format); 

    console.log("Fetching transaction")
    await fetch(`${baseApiUrl}airtel-pending_txns`, {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
    },
    })
    .then(response => response.json())
    .then( async (response) => {
    const channel = response.automation_channel;
    // && channel === 'SAMICAUTOMATION'
    if(response.data.length > 0 && channel === 'SAMICAUTOMATION' ) {
      for(const eachTxn of response.data){
        
        const txnId = eachTxn.id;
        const phone = eachTxn.phone_number;
        const productId = eachTxn.product_id;
        let dataSize = await getDataSize(productId);
        
        // const dataSize = '100MB (7days Validity)';
        console.log('datasize',dataSize);
        if(dataSize == 'nil'){
          console.log('No data selection found for:',txnId);
        }else{
          console.log(txnId,phone);
          
          try{
              await getDataBalance(txnId,'before').catch('Get Balance Before Error:  ' + console.error);
              // Revalidate that thes txn has not been initially processed s
              if(eachTxn.status == 0){
                await sleep(3000);
        
                  
                //  dataSize
                let responsePup =  await main(phone,dataSize).catch(console.error);
                // let resu
                // responsePup.then(function(result) { 
                let result = responsePup;
                if(result.status == 'success'){
                  //call an api here
                    const data = new URLSearchParams();
                    data.append('txnId', txnId);
                    data.append('screenMessage', result.message);
                    data.append('status', 1); 
                    console.log('vending was a success');
                    fetch(`${baseApiUrl}update-airtel-txn`, {
                      method: 'POST',
                      headers: {
                          'Accept': 'application/json',
                      },
                      body: data
                    })
                    .then(response => response.json())
                    .then( async (response) => {
                      console.log(response);
                      await getDataBalance(txnId,'after', browser).catch('Get Balance After Error:  ' + console.error);

                    });      
                }else if(result.status == 'failed'){
                  // call an api here
                  const dataa = new URLSearchParams();
                  dataa.append('txnId', txnId);
                  dataa.append('screenMessage', result.message);
                  dataa.append('status', -1);
                  console.log('vending failed');
          
                  fetch(`${baseApiUrl}update-airtel-txn`, {
                      method: 'POST',
                      headers: {
                          'Accept': 'application/json',
                      },
                      body: dataa
                    })
                    .then(response => response.json())
                    .then( async (response) => {
                        console.log(response);
                        await getDataBalance(txnId,'after', browser).catch('Get Balance After Error:  ' + console.error);
                    });

                    // .catch(err){
                    //   console.log('Update Airtel TXN ERROR: ' + err);
                    // }
        
                }else{
                  console.log('Authenticating: '+ txnId + ' phone:' + phone)
                }
                // });
        
              }else{
                console.log('Transaction seems done already for: '+ txnId + ' phone:' + phone)
              }
          }catch(err){
              console.log('Fetching txns error' + err);
          } 
        } 
      
      }
    }else{
      resetCookieCount++;
      if(resetCookieCount == 10){
          //reset cookies
          console.log('Cookie has been reset');
          resetCookie();
          resetCookieCount = 0;
      }
      console.log( 'resetCount '+ resetCookieCount,format24Hour(format) , 'No Pending Transaction. ', 'Channel is: ' + channel)        
    }
    
    });

    await browser.close()

}


async function main(phone,dataSize) {

  // const browser = await puppeteer.launch({headless: false,  defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const browser = await puppeteer.launch({headless: false,  defaultViewport: null});

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1024}); 
 
  const cookiesString = await fs.readFile('./cookies.json');
  const cookiesSet = JSON.parse(cookiesString);
  await page.setCookie(...cookiesSet);

  await page.goto('https://selfcare.ng.airtel.com:1013/EducationSuite/Home/BundleRequest',{ timeout: 0, waitUntil: 'networkidle0' });
  //await page.waitForNavigation();


  //shows the page auth failed, no cookie is availables
  // if (getCookie('edusuite') === null) {
  if (await page.$('#Request') == null) {
    console.log('SET COOKIE');

    await page.goto('https://selfcare.ng.airtel.com:1013/educationsuite/account/login/?ReturnUrl=%2FEducationSuite%2FHome%2FBundleRequest%3F',{ waitUntil: 'networkidle0' });
    //await page.waitForNavigation();


    await page.waitForSelector('#ContractNumber');
    await page.type('#ContractNumber', '3730832361');
    await page.waitForSelector('#Password');
    await page.type('#Password', 'Vend@100');
    await page.waitForSelector('#btnSave');
    await page.click('#btnSave');

    // await sleep(3000)
    //save cookies
    const cookies = await page.cookies();
    await fs.writeFile('./cookies.json',JSON.stringify(cookies,null,2)); 

    const cookiesString = await fs.readFile('./cookies.json');
    const cookiesSet = JSON.parse(cookiesString);
    await page.setCookie(...cookiesSet);
    // await browser.close();

    return { 'status' : 'authenticating','message' : 'setting cookie' };

  }else{
    
    console.log('COOKIE IS ACTIVE');
    
    resetCookieCount = 0;

    // await sleep(2000)

    await page.waitForSelector('#MobileNumber');
    await page.type('#MobileNumber', phone); 
  
    await page.waitForSelector('#Request');
    await page.select('#Request', dataSize);
  
    await page.waitForSelector('#btnAdd');
    await page.click('#btnAdd');
    await page.waitForSelector('#btnSave');
  
    await page.evaluate( async () => { await document.querySelector('#btnSave').click()})

    await sleep(2000)

    await page.waitForSelector('#tbody',{
      visible: true,
      hidden: false
    })

    //the selector that holds the res:llllk8

    const response = await page.$("#tbody > tbody > tr > td:nth-child(2)")
    const responseStatus = await (await response.getProperty('textContent')).jsonValue();
    const responseMess = await page.$("#tbody > tbody > tr > td:nth-child(3)")
    const responseMessage = await (await responseMess.getProperty('textContent')).jsonValue();
    console.log(responseStatus,responseMessage); 

    if(responseStatus === 'Ok'){
      // await browser.close();s
      return { 'status' : 'success','message' : responseMessage };
    }else{
      console.log('FAILED');
      // await browser.close();
      return { 'status' : 'failed','message' : responseMessage };
    } 
  }
}

async function resetCookie(){
  // const browser = await puppeteer.launch({headless: false,  defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const browser = await puppeteer.launch({headless: false,  defaultViewport: null});

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1024}); 
 
  await page.goto('https://selfcare.ng.airtel.com:1013/educationsuite/account/login/?ReturnUrl=%2FEducationSuite%2FHome%2FBundleRequest%3F',{ waitUntil: 'networkidle0' });
  //await page.waitForNavigation();

  await page.waitForSelector('#ContractNumber');
  await page.type('#ContractNumber', '3730832361');
  await page.waitForSelector('#Password');
  await page.type('#Password', 'Vend@100');
  await page.waitForSelector('#btnSave');
  await page.click('#btnSave');
  // await sleep(3000)
  //save cookies
  const cookies = await page.cookies();
  await fs.writeFile('./cookies.json',JSON.stringify(cookies,null,2)); 

  const cookiesString = await fs.readFile('./cookies.json');
  const cookiesSet = JSON.parse(cookiesString);
  await page.setCookie(...cookiesSet);
}

async function getDataSize(productId){
  if(productId == '974537a25b21448073ea50d687561c790cd61db8' || productId == 'f9aabb64a30e0314155b6d808f941f4cea7ef2eb'){
      return '100MB (7days Validity)';
  }
  
  else if(productId == '3efda9d4ba1ae75207579b5fcf6216afd0746a8d' || productId == '9705ef6f82762be37e9509fc2bb7729f00c94c3a'){
      return '300MB (7days Validity)';
  }
  
  else if(productId == '03aa5d61ad1dd68b7183217edafe964120d9fc59' || productId == '05404b44e72b89b4b2cf8c8fb21525e0274f0e3e'){
    return '500MB (30days Validity)';
  }
  
  else if(productId == '3ae82acb2b06f0234d3a25300140f48ed861854d' || productId == 'cd3ce1e934ab6a91c1a6dba85a2ea1cf281791b9'){
    return '1GB (30days Validity)';
  }
  
  else if(productId == '7df85d8ef20e7a63925b2459cf1651da0b948e95'){
  return '2GB (30days Validity)';
  }
  
  else if(productId == '9568e4722f6db1a9fa01117f1a3e1d1e9e3b113c'){
    return '5GB (30days Validity)';
  }
  
  else if(productId == '260f4a2f1eb1b00a904b23e0126dd1c5243e7a45'){
  return '10GB (30days Validity)';
  }
  
  else if(productId == '4e6d419420fb8f9d07b492328cd7f7170dacb0ca'){
  return '15GB (30days Validity)';
 }
  else if(productId == '1d3f8535122517640ced5a2444af9ac28f565410' ){
  return '20GB (30days Validity)';
 }
 else{
   
    //this products were not found - pWHY::.........
    //e695ed67ad3f6c90f7a3cf5cd58ee407ed74536f
    // d4d3efe91f4d1dba48eaffedbbbf5d11fa374a2e
    //58d8348a967ec755f91624aaaab59c51211d1021
    // 420894979e5082a555de99155d312be23f061ef6
    //3a5c12e696304bfa8d5a329e94715dcab7884ea8
    // 312ca0ee80679d0d4358cea2c3427bd66d108910
    //ee228c8478925c68a0da545c6825f407af881bf0
    
    return 'nil';
  }
}

// sleep(2000);


async function performTasks() {
    while (true) {
      try {
        await vendingFunction()

        await sleep(500)
      } catch (error) {
        console.error("Error occurred:", error);
        // Handle the error accordingly
      }
      await sleep(500)
    }
}

performTasks()
    .then(()=>console.log("Task execution started"))
    .catch((err) => console.log("Error starting execution: ", err))