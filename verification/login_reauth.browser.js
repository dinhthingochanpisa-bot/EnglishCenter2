async (page) => {
  const logout = await page.evaluate(async () => (await fetch('/api/auth/logout', {method: 'POST'})).status);
  if (logout !== 200) throw new Error('App logout failed');
  await page.goto('http://localhost:3000/api/auth/login');
  await page.locator('#password').waitFor({state: 'visible', timeout: 10000});
  const url = new URL(page.url());
  if (url.origin !== 'http://localhost:18080') throw new Error('Login must stay at the configured local issuer');
  if (url.searchParams.get('code_challenge_method') !== 'S256') throw new Error('PKCE must remain enabled');
  if (url.searchParams.get('prompt') !== 'login') throw new Error('Login must require explicit reauthentication');
  // Keycloak can remember the username on its reauthentication screen.
  // Its native restart control must still let the user select another account.
  if (await page.locator('#reset-login').count()) await page.locator('#reset-login').click();
  await page.locator('#username').waitFor({state: 'visible'});
  if (!await page.locator('#username').isEditable()) throw new Error('Cannot choose another account');
  return {status: 'PASS', loginFormVisible: true, pkce: 'S256', automaticDemoLogin: false};
}
