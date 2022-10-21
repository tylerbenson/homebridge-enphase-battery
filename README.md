
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge Plugin for Enphase Envoy Batteries

This plugin was developed to scratch a very specific itch that Enphase hasn't covered:
charge the battery from the grid when the power is cheaper (assuming you have net-metering and time-of-use)
so all generated electricity is sent back to the grid at higher rates. 

## Install
Install the plugin like you would any homebridge plugin.
Configure the plugin with your credentials and siteId and desired battery thresholds.

## Add to Home
When the accessory is added to your home, it presents a switch that allows you to toggle between "boosted" and regular.
You can now add automation to your home to control this, for example based on the time of day.
