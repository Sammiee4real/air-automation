// const express = require('express')
import express from "express";
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer';
import nodecron from 'node-cron';
// const puppeteer = require('puppeteer');

import userRoutes from "./routes/users.js";

  const app = express();

  async function test(){
    const sleep = (millsec) => {
        return new Promise( (resolve) => setTimeout(resolve,millsec));
      } 

    const browser = await puppeteer.launch({headless: false,  defaultViewport: null});
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900});
    await page.goto('file:///C:/Users/trekk/AppData/Local/Microsoft/Windows/INetCache/IE/B00462OB/NOVARA_COURT_Form_Review_October_2023[1].pdf',{ waitUntil: 'networkidle2' });
    await sleep(3000)
    const html =  await page.content();
  
    console.log(html);
  }
  test();
 