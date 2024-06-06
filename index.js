// const express = require('express')
import express from "express";
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer';
import nodecron from 'node-cron';
import fs from 'node:fs/promises';
import { readFile, stat } from "node:fs";
import { LocalStorage } from "node-localstorage"; 
import { Console } from "node:console";
// var LocalStorage = require('node-localstorage').LocalStorage,
var localStorage = new LocalStorage('./scratch');

// localStorage.clear() ;

// let checker = [];y
console.log('Starting from the top again');


const sleep = (millsec) => {
  return new Promise( (resolve) => setTimeout(resolve,millsec));
} 

let resetCookieCount = 0; 

const baseApiUrl = 'http://127.0.0.1:8000/api/'; // LOCAL
// const baseApiUrl = 'https://superadmin.samicsub.com/api/'; // LIVE

//cron to get databalance exclusivelyso
async function getDataBalance(txnId,balanceType){
  //Check only once per txn
  if(localStorage.getItem('balance_after_'+txnId) == null){

        // const browser = await puppeteer.launch({headless: false, defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
        const browser = await puppeteer.launch({headless: true,  defaultViewport: null});
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 1024}); 

        const cookiesString = await fs.readFile('./cookies.json');
        const cookiesSet = JSON.parse(cookiesString);
        await page.setCookie(...cookiesSet);

        await page.goto('https://selfcare.airtel.com.ng/EducationSuite/Contract/Balance',{ timeout: 0, waitUntil: 'networkidle0' });
        // await page.waitForNavigation(0);  

        //shows the page auth failed, no cookie is availables
        // if (getCookie('edusuite') === null) {
        if (await page.$('#tblpaymentHistory_filter') == null) {
          console.log('SET COOKIE for balance');

          await page.goto('https://selfcare.airtel.com.ng/EducationSuite/Home/BundleRequest',{ waitUntil: 'networkidle0' });
          // await page.waitForNavigation(0);

          await page.waitForSelector('#ContractNumber');
          await page.type('#ContractNumber', '3730832361');
          await page.waitForSelector('#Password');
          await page.type('#Password', 'Vend@100');
          await page.waitForSelector('#btnSave');
          await page.click('#btnSave');

          await sleep(8000)
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
          await sleep(8000);
        
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
          data.append('id', txnId);
          // console.log('balance was logged');

          fetch(`${baseApiUrl}fetch-and-save-airtel-balance`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: data
          })
          .then(response => response.json())
          .then(response => {
              localStorage.setItem('balance_after_'+txnId,txnId);
              console.log(response.message, 'balance after set for ' + txnId );
          });
          await browser.close();
        }

  }else{
    console.log( 'balance ALREADY set for ' + txnId );

  }
   
}


//entire vending function
async function vendingFunction(){

  const date = new Date();   

  const formatData = (input) => { 
    if (input > 9) { 
      return input; 
    } else return `0${input}`; 
  }; 
    
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
    return `${dd}-${mm}-${yyyy} ${hh}:${MM}:${SS}`; 
  }; 


    fetch(`${baseApiUrl}automation_airtel_pending_txns_test`, {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
    },
    })
    .then(response => response.json())
    .then( async (response) => {
    const channel = response.automation_channel;
    // && channel === 'SAMICAUTOMATION'
    if( response.data.length >  0) {
       for(const eachTxn of response.data){   

          //ONLY ALLOW PROCESSING IF THIS TXN HAS NOT BEEN PICKED
          // console.log('check actual status:'+localStorage.getItem('txn_2998828'));
          
          
          if(localStorage.getItem('lock_txn_'+eachTxn.id) == null){
               // let eachTxn = response;
               console.log('Picking: '+ eachTxn.id, localStorage.getItem('lock_txn_'+eachTxn.id)); //this should be NULL
               localStorage.setItem('lock_txn_'+eachTxn.id,eachTxn.id); //setting it here
               console.log('Yes, Now Picked: '+ eachTxn.id, localStorage.getItem('lock_txn_'+eachTxn.id));

                const txnId = eachTxn.id;
                const phone = eachTxn.phone_number;
                const productId = eachTxn.product_id;
                let dataSize = getDataSize(productId);
                
                // const dataSize = '100MB (7days Validity)';
                console.log('datasize',dataSize);

                if(dataSize == 'nil'){
                  console.log('No data selection found for:',txnId);
                }else{
                  console.log(txnId,phone);
                  
                  try{
              
                      // await getDataBalance(txnId,'before').catch('Get Balance Before Error:  ');
                      // Revalidate that thes txn has not been initially processed s

                      try{
                              if(eachTxn.status == 0){
                                sleep(3000);
                      
                                
                                    //  dataSize
                                    // if (  checker.includes(txnId)   ){
                                    let responsePup =  await main(phone,dataSize,txnId).catch(console.error);
                                    // let responsePup =  await main(phone,dataSize);
                                    // console.log(responsePup);
                                  
                                    // await main(phone,dataSize)
                                    // .then(response => response.json())
                                    // .then( async (resultt) => {
                                    // then(function(resultt) { 
                                    let resultt = responsePup;
                                    if(resultt.status == 'success'){
                                        //call an api here
                                        const data = new URLSearchParams();
                                        const status = localStorage.getItem('txn_'+txnId).split('_')[1];

                                        data.append('txnId', txnId);
                                        data.append('screenMessage', resultt.message);
                                        data.append('status', status); 
                                        data.append('picked_status',  1);
                                        data.append('failure_retry_count',  eachTxn.failure_retry_count);
                                        console.log('vending was a success');

                                        fetch(`${baseApiUrl}update-automation-txn`, {
                                          method: 'POST',
                                          headers: {
                                              'Accept': 'application/json',
                                          },
                                          body: data
                                        })
                                        .then(response => response.json())
                                        .then( async (response) => {
                                              // console.log(response);
                                              if(localStorage.getItem('balance_after_'+txnId) == null){
                                                await getDataBalance(txnId,'after').catch('Get Balance After Error:  ');
                                              }
                                        });      
                                    }else if(resultt.status == 'failed'){
                                      // call an api here
                                      const dataa = new URLSearchParams();
                                      const status = localStorage.getItem('txn_'+txnId).split('_')[1];
                                      dataa.append('txnId', txnId);
                                      dataa.append('screenMessage', resultt.message);
                                      dataa.append('status',  status);
                                      dataa.append('picked_status',  1);
                                      dataa.append('failure_retry_count',  eachTxn.failure_retry_count);
                                      console.log(resultt.message);
                              
                                      fetch(`${baseApiUrl}update-automation-txn`, {
                                          method: 'POST',
                                          headers: {
                                              'Accept': 'application/json',
                                          },
                                          body: dataa
                                        })
                                        .then(response => response.json())
                                        .then( async (response) => {
                                            console.log(response);
                                            if(localStorage.getItem('balance_after_'+txnId) == null){
                                              await getDataBalance(txnId,'after').catch('Error trying to get BalanceAfter');
                                            }
                                          
                                        });
                    
                                        // .catch(err){
                                        //   console.log('Update Airtel TXN ERROR: ' + err);
                                        // }
                            
                                    }else{
                                      console.log('Authenticating: '+ txnId + ' phone:' + phone)
                                    }
                                  
                                  //  });
                              // }else{
                                // console.log('Data already processed for '+ txnId)
                              // }

                      
                            }else{
                              console.log('Transaction seems done already for: '+ txnId + ' phone:' + phone)
                            }
                      }catch(errr){
                        console.log('Looks like timeout error: ' + errr);

                      }
                     
                  }catch(err){
                      console.log('Fetching txns error: ' + err);
                  } 
                } 
          }else{

            //USE THIS OPPORTUNITY TO CHECK IF BOT HAS PROCESSED SOME LOCKED TXNS
            // for (var i = 0; i < localStorage.length; i++){
            //   if(localStorage.getItem(localStorage.key(i))){

            //   }
            // } 

            //here shows that the transaction has been locked/picked by puppeteer and should now be checked if successful or not:
            console.log('Already picked before: '+ eachTxn.id,eachTxn.phone_number, localStorage.getItem('lock_txn_'+eachTxn.id));
            // && localStorage.getItem('balance_after_'+eachTxn.id) != null
            if(localStorage.getItem('txn_'+eachTxn.id) != null){
                  ////HERE ALREADY PICKED BUT WE NOTICED THAT IT FINALLY PICKED, THEN WE GET THE DETAILS
                  let statuss = localStorage.getItem('txn_'+eachTxn.id).split('_')[1];

                  //set counter for this txn:
                  const dataa = new URLSearchParams();
                  const txnId = eachTxn.id;
                  dataa.append('txnId', txnId);
                  dataa.append('screenMessage', 'Looks like it finally processed with status of '+statuss+' on retry count: '+ eachTxn.failure_retry_count);
                  dataa.append('status',  statuss); //the value here says we not sure know what is happening
                  dataa.append('picked_status',  1);
                  dataa.append('failure_retry_count',  eachTxn.failure_retry_count); //we can add failure_retry_count if its up to 5 then mark it as failed...
                  console.log('Looks like it processed... this is status: '+ statuss,eachTxn.phone_number, eachTxn.id+'....');

          
                  fetch(`${baseApiUrl}update-automation-txn`, {
                      method: 'POST',
                      headers: {
                          'Accept': 'application/json',
                      },
                      body: dataa
                    })
                    .then(response => response.json())
                    .then( async (response) => {
                        console.log(response);
                        if(localStorage.getItem('balance_after_'+txnId) == null){
                          await getDataBalance(txnId,'after').catch('Get Balance After Error:  ');
                        }
                      
                  });

            }else{

                //txn status is not known here, reason we push to confirm... which we want to avoid
                let failure_retry_count = eachTxn.failure_retry_count;
                console.log('Txn status undetermined yet... retry count: '+ failure_retry_count);         
            
                // || (localStorage.getItem('txn_'+eachTxn.id) == null && localStorage.getItem('balance_after_'+eachTxn.id) != null)
                if( parseInt(failure_retry_count) >= 3 || ( localStorage.getItem('txn_'+eachTxn.id) == null && localStorage.getItem('balance_after_'+eachTxn.id) != null )  ){
                    //mark the transaction as LIKELY FAILED
                    // leyin aponle, abuku lo kan
                    var statuss = -1; // 
                    var picked_status  = 1;
                    var screen_message  = 'Marked as likely failed on max. failure retry count: '+failure_retry_count;
                
                    //set counter for this txn:
                    const dataa = new URLSearchParams();
                    const txnId = eachTxn.id;
                    dataa.append('txnId', txnId);
                    dataa.append('screenMessage',screen_message);
                    dataa.append('status',  statuss); //the value here says we not sure know what is happening
                    dataa.append('picked_status',  picked_status);
                    dataa.append('failure_retry_count',  failure_retry_count++); //we can add failure_retry_count if its up to 5 then mark it as failed...
            
                    fetch(`${baseApiUrl}update-automation-txn`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                        },
                        body: dataa
                      })
                      .then(response => response.json())
                      .then( async (response) => {
                          console.log(response);
                          if(localStorage.getItem('balance_after_'+txnId) == null){
                            await getDataBalance(txnId,'after').catch('Get Balance After Error:  ');
                          }
                        
                    });

                    //you can now clear its record from local storage
                    if(localStorage.getItem('txn_'+txnId) != null){
                      localStorage.removeItem('txn_'+eachTxn.id);
                    }

                    if(localStorage.getItem('balance_after_'+txnId) != null){
                      localStorage.removeItem('balance_after_'+eachTxn.id);
                    }

                    if(localStorage.getItem('lock_txn_'+txnId) != null){
                      localStorage.removeItem('lock_txn_'+eachTxn.id);
                    }
                   
                }else{

                  //giving the txn second/third chance to behave sensibly

                  var statuss = 0; // 
                  var picked_status  = 0;
                  var screen_message  = 'Status could not be determined...resent for processing on failure count: '+failure_retry_count;
              
                  //set counter for this txn:
                  const dataa = new URLSearchParams();
                  const txnId = eachTxn.id;
                  dataa.append('txnId', txnId);
                  dataa.append('screenMessage',screen_message);
                  dataa.append('status',  statuss); //the value here says we not sure know what is happening
                  dataa.append('picked_status',  picked_status);
                  dataa.append('failure_retry_count',  failure_retry_count++); //we can add failure_retry_count if its up to 5 then mark it as failed...
          
                  fetch(`${baseApiUrl}update-automation-txn`, {
                      method: 'POST',
                      headers: {
                          'Accept': 'application/json',
                      },
                      body: dataa
                    })
                    .then(response => response.json())
                    .then( async (response) => {
                        console.log(response);
                        if(localStorage.getItem('balance_after_'+txnId) == null){
                          await getDataBalance(txnId,'after').catch('Get Balance After Error:  ');
                        }
                      
                  });

                }
            }
          }
      
      }
    }else{
      //this block is running only because there are currently no pending txns
      resetCookieCount++;
      if(resetCookieCount == 2){
        
        //Debugging::: dont clear local storage, try to clear only the records that have been processed
        // Debugging:: on a second thought, we can have it cleared because at the 6th count there is likely no transaction processing at that point
        localStorage.clear();
        console.log('Local storage cleared');

      

      }
      if(resetCookieCount == 10){
          //reset cookies
          console.log('Cookie has been reset');
          // checker = [];

          resetCookie();
          resetCookieCount = 0;
      }

      //TODO: lets try and loop the storage
      // for ( var i = 0; i < localStorage.length; ++i ) { 
      //   console.log(localStorage.getItem(localStorage.key(i)));
      // }

      console.log( 'resetCount '+ resetCookieCount,format24Hour(format) , 'No Pending Transaction. ', 'Channel is: ' + channel)        
    }
    
    });

}


async function main(phone,dataSize,txn_id) {

  console.log('Check if txn exists:::: ',localStorage.getItem('txn_'+txn_id));

  if ( localStorage.getItem('txn_'+txn_id) != null  ){
    return { 'status' : 'failed', 'error_type' : 'duplicate','message' : 'Sorry seems this transaction ID: '+txn_id+' was vended a while ago' };
  }

  // const browser = await puppeteer.launch({headless: true,  ignoreHTTPSErrors: true, 
  //     acceptInsecureCerts: true, 

  //     // executablePath:'/Applications/Firefox.app/Contents/MacOS/firefox',
  //     args: ['--proxy-bypass-list=*', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-first-run', '--no-sandbox', '--no-zygote', '--single-process', '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--enable-features=NetworkService'],
  //   defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const browser = await puppeteer.launch({headless: true,  defaultViewport: null});

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1024}); 
 
  const cookiesString = await fs.readFile('./cookies.json');
  const cookiesSet = JSON.parse(cookiesString);
  await page.setCookie(...cookiesSet);

  await page.goto('https://selfcare.airtel.com.ng/EducationSuite/Home/BundleRequest',{ timeout: 0, waitUntil: 'networkidle0' });
  //await page.waitForNavigation(0);


  //shows the page auth failed, no cookie is availables
  // if (getCookie('edusuite') === null) {
  if (await page.$('#Request') == null) {
    console.log('SET COOKIE');

    await page.goto('https://selfcare.airtel.com.ng/educationsuite/account/login/?ReturnUrl=%2FEducationSuite%2FHome%2FBundleRequest',{ waitUntil: 'networkidle0' });
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

  }
  
  else{
    
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
            let responseMessage = await (await responseMess.getProperty('textContent')).jsonValue();
            console.log(responseStatus,responseMessage); 

              let deceptiveSuccessMessage = "Invalid character after parsing property name";
            

            if(responseStatus === 'Ok' ||  responseMessage.includes(deceptiveSuccessMessage) === true){
              // await browser.close();ss
              // if (!checker.includes(txn_id)){
              //   checker.push(txn_id);  //add the txn only after processing
              // }
              localStorage.setItem('txn_'+txn_id,txn_id+'_1');
              console.log('SUCCESS',localStorage.getItem('txn_'+txn_id));
              return { 'status' : 'success','message' : responseMessage };
            }else{
              // if (!checker.includes(txn_id)){
              //   checker.push(txn_id);  //add the txn only after processing
              // }
              localStorage.setItem('txn_'+txn_id,txn_id+'_-1');
              console.log('FAILED',localStorage.getItem('txn_'+txn_id));

              // await browser.close();
              return { 'status' : 'failed','error_type' : 'nil','message' : responseMessage };
            }  
  }

}

async function resetCookie() {
  // const browser = await puppeteer.launch({headless: true,  defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const browser = await puppeteer.launch({headless: true,  defaultViewport: null});

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1024}); 
 
  await page.goto('https://selfcare.airtel.com.ng/educationsuite/account/login/?ReturnUrl=%2FEducationSuite%2FHome%2FBundleRequest',{  timeout: 0, waitUntil: 'networkidle0' });
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
}

function getDataSize(productId){
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

// sleep(2000);C


async function performTasks() { 
  while (true) {
    try {
      await vendingFunction()

      await sleep(7000)

    } catch (error) {
      console.error("Error occurred:", error);
      // Handle the error accordingly
    }
    await sleep(5000)
  }
}

performTasks()
  .then(()=>console.log("Task execution started"))
  .catch((err) => console.log("Error starting execution: ", err))


