# Stardust, A Fantasy Life Online server emulator
Currently (ab)using my own static files taken from packet captures.

#### Level of Functionality
Right now, the only thing this code does is allow a person into the game (using my account and data), and then immediately softlocks. It'll be a while before it's even close to remotely functional.

### How to Use, if you're crazy enough to do that
Download [Node](https://nodejs.org/en/download/)
Run `npm install`, and then `npm start`
If you see "Stardust, Online". Congratulations! You started the server.

However, that's not all. In order to actually use the server, you'll need to create SSL certificates, or remove them.
Removing them from the code is simple:
- Comment out line 77.
- Replace line 78 with `var server = https.createServer(Stardust).listen(80, function() {`
- Change the port (80, in the example above) to whatever you'd like.
- That's it.

Additionally, you'll have to create a set of server certificates for the game to use, as well as patch them in, which I'm not going to cover just yet.

## More info
Development takes place in the [Cherrymint](https://discord.com/invite/QKMRTErDHd) Discord server. It's slow, but small bits of progress are being made. Stop by if you want to ask a question!

