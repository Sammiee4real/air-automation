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

// var formattedDate, datee;

// localStorage.clear() ;


// let checker = [];y
console.log('Starting from the top again::: confirm uncertain txns');


const sleep = (millsec) => {
  return new Promise( (resolve) => setTimeout(resolve,millsec));
} 

let resetCookieCount = 0; 

// const baseApiUrl = 'http://127.0.0.1:8000/api/'; // LOCALdd
const baseApiUrl = 'https://superadmin.samicsub.com/api/'; // LIVE




//get status of transaction
async function confirmTransaction(phone,datee,txnId,failure_retry_count){
  

 
  // const browser = await puppeteer.launch({headless: false, defaultViewport: null, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
        const browser = await puppeteer.launch({headless: true,  defaultViewport: null});
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 1024}); 

        const cookiesString = await fs.readFile('./cookies.json');
        const cookiesSet = JSON.parse(cookiesString);
        await page.setCookie(...cookiesSet);

        await page.goto('https://selfcare.airtel.com.ng/EducationSuite/Home/GetGiftingNumbers',{ timeout: 0, waitUntil: 'networkidle0' });
        // await page.waitForNavigation(0);  

        //shows the page auth failed, no cookie is availables
        // if (getCookie('edusuite') === null) {
        if (await page.$('#contractNumber') == null) {
          console.log('SET COOKIE for txn confirmation');

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

          console.log('COOKIE IS ACTIVE for confirmation');
          resetCookieCount = 0;
          await sleep(3000);
    

          // console.log('another checkkkk',dateee)
          var datttt = datee.split(" ")[0];
          let actualDate = datttt.split("-")[1]+'/'+datttt.split("-")[2]+'/'+datttt.split("-")[0];
         
          await page.waitForSelector('#startDate');
          await page.focus('#startDate');
          await page.$eval('#startDate',(e) => e.removeAttribute("readonly"));
          await page.type('#startDate',actualDate);
          // await sleep(12000);


          await page.waitForSelector('#endDate');
          await page.focus('#endDate');
          await page.$eval('#endDate',(e) => e.removeAttribute("readonly"));
          await page.type('#endDate',actualDate);


          // await page.waitForSelector('#endDate');
          // await page.type('#endDate', kkkkk);
          // // await page.$eval('#endDate', el => el.value =  '01/02/2024');
        

          await page.waitForSelector('#btnload');
          await page.click('#btnload');
          await sleep(2000);

          await page.waitForSelector('#tblHistory > tbody',{
            visible: true,
            hidden: false
          })
          // await sleep(2000);

          await page.waitForSelector('#tblHistory_filter > label > input');
          await page.type('#tblHistory_filter > label > input', phone);
          // 08168509044
          // 07010142774
          // 07010157884
          // 07010651207
          await sleep(2000);


          await page.keyboard.press('Enter');
          await sleep(8000);

          //the selector that holds the res:llllk8

          try {
            

            let response = await page.$("#tblHistory > tbody > tr:nth-child(1) > td:nth-child(5)");
          

            if(response != null){
              const responseStatus = await (await response?.getProperty('textContent')).jsonValue();
              const responseMess = await page.$("#tblHistory > tbody > tr:nth-child(1) > td:nth-child(6)");
              let responseMessage = await (await responseMess?.getProperty('textContent')).jsonValue();
              let successMessage = 'You have successfully gifted';

              const responsePhone = await page.$("#tblHistory > tbody > tr:nth-child(1) > td:nth-child(1)");
              await sleep(3000);

              let responsePhoneReal = await (await responsePhone?.getProperty('textContent')).jsonValue();

              // const responseDate = await page.$("#tblHistory > tbody > tr:nth-child(1) > td: nth-child(3)");

              //ensure the phone is same,
              //ensure the recors are not more than 2

              console.log('comparing phone',phone,responsePhoneReal);

       
              if( responsePhone != null 
                  && responseMessage.includes(successMessage) === true 
                  && responsePhoneReal == phone ){
                
                //second level check: check duplicate
                let checkDuplicate = await page.$("#tblHistory > tbody > tr:nth-child(2) > td:nth-child(5)");
                if(checkDuplicate != null){
                  var status = 1;
                  var picked_status = 1;
                  var message = 'Duplicate result...Please confirm manually';
                  console.log('Duplicate result...Please confirm manually',phone, txnId);
                }else{
                  var status = 1;
                  var picked_status = 1;
                  var message = responseMessage;
  
                  console.log('Transaction confirmed as successful:',responseStatus,responseMessage,txnId); 
                }

              }else{
                var status = -1;
                var picked_status = 1;
                var message = 'Transaction confirmed as failed';
                console.log('Transaction confirmed as failed:' ,phone,txnId); 
              }
            }else{
              //here the number could be a valid airtel number and yet not found, candidate for reprocessing
              function determineAirtelNumber(phone){
                var airtelArray = [
                  '0701',
                  '0708',
                  '0802',
                  '0808',
                  '0812',
                  '0902',
                  '0907',
                  '0901',
                  '0912',
                  '0904',
                ];
                var firstFourDigits = phone.substring(0, 4).toString();
                if(airtelArray.includes(firstFourDigits)){
                  return true;
                }
                return false;    
              }
             
              if(determineAirtelNumber(phone)){
                var status = 0;
                var picked_status = 0;
                failure_retry_count++; //here failure count should now be 1
                var message = 'This phone number is airtel and sent for reprocessing';
                console.log('This phone number is airtel and sent for reprocessing: ', txnId, phone,'failure count:' +failure_retry_count);  
              }else{
                var status = -1;
                var picked_status = 1;
                var message = 'Could not find transaction, confirmed as failed';
                console.log('Could not find transaction, confirmed as failed',phone, txnId);  
              }
              
            }
           
          } catch (error) {
            console.log(error)
          }
         
    
          // //log to server
          const data = new URLSearchParams();
          data.append('status', status);
          data.append('screen_message', message);
          data.append('picked_status', picked_status);
          data.append('failure_retry_count', failure_retry_count);
          data.append('id', txnId);
    

          fetch(`${baseApiUrl}update_unconfirmed_txns`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: data
          })
          .then(response => response.json())
          .then(response => { 
             console.log(response.message );
          });

          await browser.close();
        
        } 
}


//entire vending function
async function mainConfirmation(){
  // const sleep = (millsec) => {
  //   return new Promise( (resolve) => setTimeout(resolve,millsec));
  // } 

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
    

    fetch(`${baseApiUrl}confirm_airtel_txns`, {
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
      // console.log(response);  


      for(let eachTxn of response.data){        
              
                try{
             
                  const txnId = eachTxn.id;
                  const phone = eachTxn.phone_number;
                  const productId = eachTxn.product_id;
                  var dateerr = eachTxn.when_bought;
                  var failure_retry_count = eachTxn.failure_retry_count;
                
                  console.log('Confirming transaction:', txnId, phone);
                  await confirmTransaction(phone,eachTxn.when_bought,txnId,failure_retry_count).catch(console.error);
                 
               
                  }catch(err){
                      console.log('Fetching txns error: ' + err);
                  }   
      }
    }else{
      resetCookieCount++;
      if(resetCookieCount == 9){
        localStorage.clear();
        console.log('Local storage cleared');

      }
      if(resetCookieCount == 7){
          //reset cookies
          console.log('Cookie has been reset');
          // checker = [];
          resetCookie();
          resetCookieCount = 0;
      }
      console.log( 'resetCount '+ resetCookieCount,format24Hour(format) , 'No Pending Unconfirmed Transaction. ', 'Channel is: ' + channel)        
    }
    
    });

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


async function performTasks() { 
  while (true) {
    try {
      // await vendingFunction()
      await mainConfirmation()
      await sleep(55000)

    } catch (error) {
      console.error("Error occurred:", error);
      // Handle the error accordingly
    }
    await sleep(5500)
  }
}

performTasks()
  .then(()=>console.log("Task execution started"))
  .catch((err) => console.log("Error starting execution: ", err))


