import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service,
} from 'homebridge';
import fetch from 'node-fetch';

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module
 * (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('EnphaseBatteryHomebridgePlugin', EnphaseBattery);
};

// Request URL: https://enlighten.enphaseenergy.com/pv/systems/3419276/today

class EnphaseBattery implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly name: string;
  private readonly siteId: string;

  private readonly batteryService: Service;
  private readonly informationService: Service;

  private cookie;

  constructor(log: Logging, config: AccessoryConfig) {
    this.log = log;
    this.config = config;
    this.name = config.name;
    this.siteId = config.siteId;
    this.cookie = this.authenticate();

    this.batteryService = new hap.Service.Switch(this.name + ' Full Backup');
    this.batteryService.getCharacteristic(hap.Characteristic.On)
      .onGet(async () => {
        const currentBatteryProfile = await this.getCurrentBatteryProfile();
        return currentBatteryProfile === 'backup_only';
      })
      .onSet(async (state) => {
        const backupEnabled = state as boolean;
        const batteryProfile = backupEnabled ? 'backup_only' : config.defaultBatteryProfile;
        await this.setBatteryProfile(batteryProfile);
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Enphase')
      .setCharacteristic(hap.Characteristic.SerialNumber, config.siteId);
  }

  /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
  getServices(): Service[] {
    return [
      this.informationService,
      this.batteryService,
    ];
  }

  // https://enlighten.enphaseenergy.com/login/login
  async authenticate() {
    return fetch('https://enlighten.enphaseenergy.com/login/login', {
      method: 'post',
      body: `user%5Bemail%5D=${encodeURIComponent(this.config.email)}&user%5Bpassword%5D=${encodeURIComponent(this.config.password)}`,
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      redirect: 'manual',
    })
      .then(res => res.headers)
      .then(headers => headers.get('Set-Cookie'))
      .then(cookies => cookies.split(','))
      .then(cookies => cookies.flatMap(cookie => cookie.split(';')))
      .then(cookies => cookies.find(cookie => cookie.includes('session')))
      .then(cookie => cookie.trim());
  }

  // GET https://enlighten.enphaseenergy.com/service/batteryConfig/api/v1/profile/3419276
  async getCurrentBatteryProfile() {
    try {
      const cookie = await this.cookie;
      const response = await fetch(`https://enlighten.enphaseenergy.com/service/batteryConfig/api/v1/profile/${this.siteId}`, {
        method: 'get',
        headers: {'Cookie': cookie},
      });
      const json = await response.json();
      const batteryProfile = json.data.profile;
      this.log.debug(`CurrentProfile: ${this.siteId} ${this.name} at ${batteryProfile}`);
      return batteryProfile;
    } catch (error) {
      this.log.error(`CurrentProfile error: ${error}, reconnect in 15s.`);
      this.reconnect();
    }
  }

  // PUT https://enlighten.enphaseenergy.com/service/batteryConfig/api/v1/profile/3419276
  async setBatteryProfile(batteryProfile: string) {
    this.log.info(`SetBatteryProfile ${this.siteId} ${this.name} to ${batteryProfile}`);
    try {
      const cookie = await this.cookie;
      const response = await fetch(`https://enlighten.enphaseenergy.com/service/batteryConfig/api/v1/profile/${this.siteId}`, {
        method: 'put',
        body: `profile=${batteryProfile}`,
        headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie},
      });
      const text = await response.text();
      this.log.debug(`BatteryProfile updated. Response: ${text}`);
    } catch (error) {
      this.log.error(`SetBatteryProfile error: ${error}, reconnect in 15s.`);
      this.reconnect();
    }
  }

  reconnect() {
    setTimeout(() => {
      this.cookie = this.authenticate();
    }, 15000);
  }
}
