const puppeteer = require("puppeteer");
// require('dayjs/locale/pt-br')
const csv = require("csvtojson");
const fs = require("fs");

const dayjs = require("dayjs");

// dayjs.locale('pt-br');
const payload = {
  startDate: "20/01/2024",
  endDate: "21/03/2024",
  accessEmail: "edmonteironet@gmail.com",
};


const extractPaylaod = (payload) => {
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    accessEmail: payload.accessEmail,
  };
};

(async () => {
  
  const diffDays = await handleDifBetweenDates(payload);
  console.log('Intervalo total de dias: ',diffDays)
  for (let i = 0; i < diffDays; i++) {
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
    });
    const page = await browser.newPage();
    const formatedDateStarter = payload.startDate.split('/').reverse().join('-');

    const currentDay = dayjs(formatedDateStarter).add(i, "days").format("DD/MM/YYYY");
    await automationFlux(page, {startDate: currentDay, endDate: currentDay, accessEmail: payload.accessEmail})
    await browser.close();
    // await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  

})();

async function handleWithResultsFound(page) {
  try {
    await page.waitForSelector("#formItensBPS\\:tabelaBPS\\:j_id375",{timeout: 10000})
    const totalOfResults = await page.$eval(
      "#formItensBPS\\:tabelaBPS\\:j_id375",
      (element) => {
        console.log(element.innerText);
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
    
    return {
      currentPage:0, 
      totalOfPages:0, 
      totalOfRecords:0 
    };
    
  }
  

  
}

async function handleWithMoreThanThousandRecords ({}) {

}

async function handleWithNameFiles () {
  const files = fs.readdirSync('./temp/') 
  console.log(files)
  return files;
  // fs.renameSync("./temp/relatorio.csv", "./temp/relatorio.csv");
}

async function automationFlux (page, payload) {
  try {

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
  
    await page.type("#formLogin\\:txtEmail1", accessEmail);
    await page.click("#formLogin\\:btnAcessarConsultaPublica");
  
    await page.waitForSelector(
      "#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a",
    );
  
    const buttonSection = await page.$eval(
      "#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a",
      (elemento) => {
        elemento.click();
      },
    );
  
    const currentSelector = await page.waitForSelector(
      "#barraMenu > ul:nth-child(1) > li > ul > li:nth-child(1) > a",
    );
  
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
  
  
    await page.waitForSelector("#formItensBPS\\:j_id201"); //Espera o painel que possui os inputs de datas;
  
    await handleInputDates(page, payload);
    console.log("Aguarde buscando dados referente ao dia: ", payload.startDate);
    await page.waitForNetworkIdle(); // Espera até que a requisição da pesquisa seja concluída
  
    // await page.waitForSelector("#formItensBPS\\:tabelaBPS\\:j_id375", {timeout: 1000000});
  
    const { totalOfRecords } = await handleWithResultsFound(page);
    console.log(`Busca concluída com sucesso! Total de dados encontrados: ${totalOfRecords}`)

    if(totalOfRecords === 0){
      // throw new Error('Nenhum registro encontrado');
      return await page.close();
    }
  
    if(totalOfRecords < 1000){
      await handleDownloadCsv(client, page);
      await handleDownloadPdf(client, page);
      await handleNameFiles(await handleWithNameFiles());
    }else{
  
    }
  } catch (error) {
    console.error(error);
    await page.screenshot()
  }
  
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

  // console.log({
  //   startDateInput,
  //   endDateInput,
    
  // })

  if(startDateInput !== payload.startDate || endDateInput !== payload.endDate){
    // console.log('Ocorreu um erro no preenchimento no input de data')
    // if(attempt < 3) {
    //   attempt++;
     
    // }else{
    //   throw new Error('Ocorreu um erro ao preencher as datas');
    // }
    await handleInputDates(page, payload);
    return;
  }else{
    await page.waitForSelector("#conteudo > div:nth-child(2) > input"); // Garante que o botão pesquisar esteja na tela
    await page.click("#conteudo > div:nth-child(2) > input"); // Clica no botão pesquisar
  }
  
 

  
}

async function handleDownloadCsv(client, page) {
  console.log("Entrou na função para fazer download do csv")
  await page.waitForSelector("#formItensBPS\\:j_id219 > fieldset > div:nth-child(3) > input");
  await page.click("#formItensBPS\\:j_id219 > fieldset > div:nth-child(3) > input");
  await page.waitForNetworkIdle({timeout: 1000000});
}

async function handleDownloadPdf (client, page) {
  console.log("Entrou na função para fazer download do pdf")
  await page.waitForSelector("#formItensBPS\\:j_id219 > fieldset > div:nth-child(4) > input")
  await page.click("#formItensBPS\\:j_id219 > fieldset > div:nth-child(4) > input")
  await page.waitForNetworkIdle({timeout: 1000000});
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

async function handleNameFiles (fileNames) {
  const destinationDir = `./${payload.startDate.replace(/\//g, '-')}_${payload.endDate.replace(/\//g, '-')}`;
  fs.mkdirSync(destinationDir);

  for (let index = 0; index < fileNames.length; index++) {
    const fileName = fileNames[index];
    fs.rename(`./temp/${fileName}`, `./${destinationDir}/${fileName}`, (err) => {
      if (err) throw err;
      console.log('Rename complete!');
    });
  }

  fs.rmdir('./temp',{recursive: true}, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('temp is deleted!');
  }
  );
}
