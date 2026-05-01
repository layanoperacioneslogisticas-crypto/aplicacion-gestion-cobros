import { Builder, By, until } from 'selenium-webdriver';

async function probarAplicacion() {
  console.log("Iniciando prueba con Selenium...");
  let driver = await new Builder().forBrowser('chrome').build();
  
  try {
    console.log("Navegando a http://localhost:5173 ...");
    await driver.get('http://localhost:5173');
    
    // Esperamos hasta 5 segundos a que el ttulo cargue (indicando que Vite y React funcionan)
    await driver.wait(until.titleIs('Gestión de Cobros Transporte'), 5000);
    console.log("Prueba exitosa! El navegador abri el sitio y el ttulo es correcto.");
    
  } catch (error) {
    console.error("La prueba fall o hubo un error:", error.message);
  } finally {
    console.log("Cerrando el navegador...");
    await driver.quit();
  }
}

probarAplicacion();
