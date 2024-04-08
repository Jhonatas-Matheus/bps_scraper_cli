const puppeteer = require("puppeteer");
const dayjs = require("dayjs");


let divisor = 2;
let result = [];

module.exports = async function verifyQuantityRegister(payloads, limit, originalPayload) {
  console.log("Verificando quantidade de registros, no intervalo fornecido...")
    for (let i=0; i < payloads.length; i++){
        const payload = payloads[i];
        const  { client, page } = await handleLoginOnSystem(payload);
        await handleNavigateToSearchSection(page);
        await handleInputDates(page, payload);
        const { totalOfRecords } = await handleWithResultsFound(page);
        if(totalOfRecords > limit){
          console.log(`Foi identificado uma quantidade de registros muito alta no intervalo, ${payload.startDate} - ${payload.endDate}. Dividindo em intervalo menores para garantir o funcionamento...`)
            await handleWithDataSplit(originalPayload);
            await verifyQuantityRegister(result, limit, originalPayload)
        }
        page.close();
        return result;
    }
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
  
    const accessEmail = payload.accessEmail;

    const emailInput = await page.$$eval("#formLogin", (el) => {
      return el[0];
    });

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
  
      await page.waitForSelector("#conteudo > div:nth-child(2) > input"); // Garante que o botão pesquisar esteja na tela
      await page.click("#conteudo > div:nth-child(2) > input"); // Clica no botão pesquisar
    }
    
   
  
    
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

async function handleWithDataSplit (payload) {
    result = [];
    const diffDays = await handleDifBetweenDates(payload);
    const halfDays = diffDays / divisor;
    
    let startDateFormated = dayjs(handleFormatedDate(payload.startDate)).format("DD/MM/YYYY");
    let endDateFormated = dayjs(handleFormatedDate(payload.startDate)).add(halfDays, 'days').format("DD/MM/YYYY");
  
    let currentInterval = {};
  
    for(let i = 0; i < divisor; i++){ 
      currentInterval = {}
  
      if(i === 0){
        currentInterval = {
          startDate: startDateFormated,
          endDate: endDateFormated,
          accessEmail: payload.accessEmail
        };
  
      }else if(i === divisor - 1){
        startDateFormated = dayjs(handleFormatedDate(result[result.length - 1].endDate)).add(1, 'days').format("DD/MM/YYYY");
        endDateFormated = dayjs(handleFormatedDate(payload.endDate)).format("DD/MM/YYYY");
        currentInterval = {
          startDate: startDateFormated,
          endDate: endDateFormated,
          accessEmail: payload.accessEmail
        };
      }else{
  
        startDateFormated = dayjs(handleFormatedDate(result[result.length - 1].endDate)).add(1, 'days').format("DD/MM/YYYY");
        endDateFormated = dayjs(handleFormatedDate(startDateFormated)).add(halfDays, 'days').format("DD/MM/YYYY");
  
        currentInterval = {
          startDate: startDateFormated,
          endDate: endDateFormated,
          accessEmail: payload.accessEmail
        };
  
      }
      result.push(currentInterval);
    }

    divisor++;

    return
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

async function handleDifBetweenDates(payload) {
    const { startDate, endDate } = payload;
  
    const [startDay, startMonth, startYear] = startDate.split('/');
    const [endDay, endMonth, endYear] = endDate.split('/');
  
    const formattedStartDate = `${startYear}-${startMonth}-${startDay}`;
    const formattedEndDate = `${endYear}-${endMonth}-${endDay}`;
  
    const start = dayjs(formattedStartDate);
    const end = dayjs(formattedEndDate);
  
    const diff = end.diff(start, "days")
  
    return parseFloat(diff);
}

function handleFormatedDate (date) {
    return date.split('/').reverse().join('-');
}