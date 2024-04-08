#!/usr/bin/env node
const puppeteer = require("puppeteer");
const csv = require("csvtojson");
const fs = require("fs");
const dayjs = require("dayjs");
const { program } = require('commander');
const verifyQuantityRegister = require('./verifyQuantityRegister');

const extractPaylaod = (payload) => {
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    accessEmail: payload.accessEmail,
  };
};

// Variáveis globais do código:

let originalPayload;
let fileSerial = 1;

// -----------------------------

async function init (payload, originalPayloadParam) {

  const { page, client } = await handleLoginOnSystem(payload);

  await handleNavigateToSearchSection(page);

  await handleInputDates(page, payload);

  const { totalOfRecords } = await handleWithResultsFound(page);

  console.log('Total de registros encontrados: ',totalOfRecords);

  if(totalOfRecords > 450){
    console.log('Mais de 450 registros encontrados, sugerimos diminuir o tamanho do seu intervalo de datas. Pois o sistema não suporta mais do que 450 registros por vez.');
    return
  }else{
    await handleDownloadCsv(page);
    await handleDownloadPdf(page);
    await handleNameFiles(await verifyTempDirHasFiles(), originalPayloadParam);
  }
  page.close();



}

async function handleWithResultsFound(page) {
  return await verifyIfHasResults(page, async ()=>{
    try {
      await page.waitForSelector("#formItensBPS\\:tabelaBPS\\:j_id375")
      const totalOfResults = await page.$eval(
        "#formItensBPS\\:tabelaBPS\\:j_id375",
        (element) => {
          if(element.innerText.includes('Nenhum registro encontrado')){
            return [0,0,0]
          }
          let pagination = element.innerText;
    
          const regex = /(\d+(\.\d+)?)/g;
    
          const arrayOfNumbers = pagination.match(regex);
    
          const total = parseInt(arrayOfNumbers[arrayOfNumbers.length - 1]);
    
          return arrayOfNumbers.map((number) => parseInt(number));
        },
      );
      const [ currentPage, totalOfPages, totalOfRecords ] = totalOfResults;
  
      return {
        currentPage, 
        totalOfPages, 
        totalOfRecords 
      };
      
    } catch (error) {
      console.log('Erro ao buscar resultados, tentando novamente...')
      return await handleWithResultsFound(page);
    }
  })
}

async function  verifyIfHasResults (page, callback) {
  try {
    await page.waitForSelector("#formItensBPS\\:tabelaBPS\\:j_id377");
    return {
      currentPage:0, 
      totalOfPages:0, 
      totalOfRecords:0 
    };
  } catch (error) {
    return callback();
  }
}

async function verifyTempDirHasFiles () {
  const files = fs.readdirSync('./temp/') 
  return files;
}

async function handleLoginOnSystem (payload) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.goto(
    "https://bps.saude.gov.br/visao/consultaPublica/relatorios/geral/index.jsf",
  );

  const client = await page.target().createCDPSession();

  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: "./temp",
  });

  const accessEmail = extractPaylaod(payload).accessEmail;
  const emailInput = await page.$$eval("#formLogin", (el) => {
    return el[0];
  });
  console.log("Email que está tentando ser inserido: ", accessEmail)
  await page.type("#formLogin\\:txtEmail1", accessEmail);
  await page.click("#formLogin\\:btnAcessarConsultaPublica");

  await page.waitForSelector(
    "#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a",
  );

  return {page, client}
}

async function handleNavigateToSearchSection (page) {
  await page.waitForSelector("#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a");

  await page.$eval("#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a", (elemento) => {
      elemento.click();
    },
  );

  await page.waitForSelector("#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a");

  await page.click("#barraMenu > ul:nth-child(1) > li");

  await page.waitForSelector("#formItensBPS\\:qualificacaox");

  await page.$eval("#formItensBPS\\:qualificacaox", (element) => {
    console.log(element);
    if(element.checked){
      element.click();

    }
  });

  await page.waitForSelector("#formItensBPS\\:checkPeriodo");

  await page.$eval("#formItensBPS\\:checkPeriodo", (element) => {
    element.click();
  });
}

async function handleInputDates (page, payload) {
  attempt = 0;
 
  await page.waitForSelector("#formItensBPS\\:dataFinalInputDate");
  await page.keyboard.press('Home')


  await page.type("#formItensBPS\\:dataFinalInputDate", payload.startDate.replace(/\//g, ''), {delay: 200}); // Insere as datas

  await page.waitForSelector("#formItensBPS\\:cldDataIFInputDate");
  await page.focus("#formItensBPS\\:dataFinalInputDate")
  await page.keyboard.press('Home')


  await page.type("#formItensBPS\\:cldDataIFInputDate", payload.endDate.replace(/\//g, ''), {delay: 200}); // Insere as datas

  const startDateInput = await page.$eval("#formItensBPS\\:dataFinalInputDate", (element) => element.value);

  const endDateInput = await page.$eval("#formItensBPS\\:cldDataIFInputDate", (element) => element.value);

  if(startDateInput !== payload.startDate || endDateInput !== payload.endDate){
    await handleInputDates(page, payload);
    return;
  }else{

    console.log("Buscando dados referente ao período de: ", payload.startDate, payload.endDate);
    await page.waitForSelector("#conteudo > div:nth-child(2) > input"); // Garante que o botão pesquisar esteja na tela
    await page.click("#conteudo > div:nth-child(2) > input"); // Clica no botão pesquisar
  }
  
 

  
}

async function handleDownloadCsv(page) {
  await page.waitForSelector("#formItensBPS\\:j_id219 > fieldset > div:nth-child(3) > input");
  await page.click("#formItensBPS\\:j_id219 > fieldset > div:nth-child(3) > input");
  console.log("Fazendo download do csv, aguarde...");
  await page.waitForNetworkIdle({timeout: 0});
  const downloadedFiles = await verifyTempDirHasFiles();
  if(downloadedFiles.length < 1){
    console.log("Ocorreu um erro inesperado ao tentar fazer download do arquivo csv, tente novamente mais tarde.")
  }
  return
}

async function handleDownloadPdf (page) {
  await page.waitForSelector("#formItensBPS\\:j_id219 > fieldset > div:nth-child(4) > input");
  await page.click("#formItensBPS\\:j_id219 > fieldset > div:nth-child(4) > input");
  console.log("Fazendo download do pdf, aguarde...");
  await page.waitForNetworkIdle({timeout: 0});
  const downloadedFiles = await verifyTempDirHasFiles();
  if(downloadedFiles.length < 2){
    console.log("Ocorreu um erro inesperado ao tentar fazer download do arquivo pdf, tente novamente mais tarde.")
  }
}

async function handleNameFiles (fileNames, payload) {

  //Lidar com nome dos arquivos quando for apenas uma busca.

  const destinationDir = `./${payload.startDate.replace(/\//g, '-')}_${payload.endDate.replace(/\//g, '-')}`;
  if(!fs.existsSync(destinationDir)){
    fs.mkdirSync(destinationDir);
  }

  for (let index = 0; index < fileNames.length; index++) {
    const [fileName, extension] = fileNames[index].split('.');
    console.log(fileName, extension)
    // Nessa linha irei colocar os nomes dos arquivos como subintervalos
    fs.rename(`./temp/${fileName}.${extension}`, `${destinationDir}/${fileName}_${fileSerial}.${extension}`, (err) => {
      if (err){
        console.log(`Ocorreu um erro ao tentar salvar o arquivo ${fileName}_${fileSerial}.${extension} - ${payload.startDate.replace(/\//g, '-')}_${payload.endDate.replace(/\//g, '-')}`)
      }
      console.log('Rename complete!');
    });
  }

  fs.rmdir('./temp',{recursive: true}, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    fileSerial++;
    console.log('temp is deleted!');
    return;
  }
  );
}

// A partir daqui é apenas a configuração da CLI


program
  .command('play')
  .argument('<param1>', 'Data de início')
  .argument('<param2>', 'Data de final')
  .argument('<param3>', 'Email de acesso')
  .description('Fazer busca no intervalo de datas')
  .action(async (param1, param2, param3) => {
    console.log('Data inicial: ', param1);
    console.log('Data final: ', param2);
    console.log('Email utilizado: ', param3);
    originalPayload = {startDate: param1, endDate: param2, accessEmail: param3};

    const payloads = await verifyQuantityRegister([originalPayload], 300, originalPayload);
    // const teste = [1,2,3,4,5];
    // for(let i = 0; i < teste.length; i++){
    //   return console.log(teste[i]);
      
    // }
    for (let i=0; i< payloads.length; i++){
      await init(payloads[i], originalPayload);
    }
    process.exit();
  });

  program.parse();