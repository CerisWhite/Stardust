var express = require('express');
var errorhandler = require('express-async-handler');
var bodyParser = require('body-parser');
var compression = require('compression')
var crypto = require('crypto');
var fs = require('fs-extra');
var https = require('https');

var StaticData = require('./library/function/StaticData.js');

let IndexPage = fs.readFileSync('./static/index.html');

const ServerPrivateKey = {
	key: crypto.createPrivateKey({
			key: Buffer.from(fs.readFileSync('./cert/server_priv.der')),
			format: 'der',
			type: 'pkcs1'
		 }),
	padding: crypto.constants.RSA_PKCS1_PADDING,
	oaepHash: undefined
}
function MakeJSON(Data) {
	let LastBraceOffset = 0;
	for (let Seek in Data) {
		if (Data[Seek] == "}") { LastBraceOffset = Seek; }
	}
	Data = Data.slice(0, LastBraceOffset);
	Data += "}";
	return JSON.parse(Data);
}
function DecryptData(Data) {
	const DataHex = Buffer.from(Data.toString(), 'base64').toString('hex');
	const DataIV = Buffer.from(DataHex.slice(0, 32), 'hex');
	const DataBody = DataHex.slice(32, DataHex.length - 256);
	const DataKey = Buffer.from(DataHex.slice(DataHex.length - 256, DataHex.length), 'hex');
	const DecKey = crypto.privateDecrypt(ServerPrivateKey, DataKey);
	const DeCipher = crypto.createDecipheriv('aes-128-cbc', DecKey, DataIV);
	DeCipher.setAutoPadding(false);
	let DecBody = DeCipher.update(DataBody, 'hex', 'utf-8');
	DecBody += DeCipher.final('utf-8');
	
	return [DataIV, MakeJSON(DecBody), DecKey];
}
function EncryptData(DataIV, ResponseData, DataKey) {
	const EnCipher = crypto.createCipheriv('aes-128-cbc', DataKey, DataIV);
	let EncData = EnCipher.update(ResponseData, 'utf-8', 'base64');
	EncData += EnCipher.final('base64');
	return EncData;
}
function ReadUserData(PlayerID) {
	return "";
}
function WriteUserData(PlayerID, Data) {
	return;
}
function RecordManager (req, res, next) {
	if ((req.get('user-agent').includes("Fantasy%20Life") && req.get('content-type') == "application/json")
		|| (req.get('user-agent').includes("Dalvik") && req.get('content-type') == "application/json")) { 
		const DecryptedData = DecryptData(req.body);
		res.locals.RequestIV = DecryptedData[0];
		res.locals.RequestJSON = DecryptedData[1];
		res.locals.RequestKey = DecryptedData[2];
		if (res.locals.RequestJSON['playerId'] != undefined) {
			res.locals.UserData = ReadUserData(res.locals.RequestJSON['playerId']);
		}
		res.locals.ResultStatus = {
			"resultCode": 0,
			"textId": 500633936,
			"reconnection": 0,
			"resultBehavior": "Ignore"
		}
		res.locals.SystemStatus = {
			"clientUpdate": 0,
			"masterDataUpdate": 0,
			"masterDataVersion": 557,
			"serverDt": Math.floor(Date.now())
		}
	}
	next();
}

var Stardust = express();
Stardust.use(bodyParser.raw({ type: ['application/json', 'application/octet-stream'], limit: "4mb" }));
Stardust.use(compression());
Stardust.use(express.static('static', {dotfile: 'ignore', etag: false}));
Stardust.disable('x-powered-by');
Stardust.disable('ETag');
Stardust.use(RecordManager);
var StardustConfig = {key:fs.readFileSync('./cert/privkey.pem'),cert:fs.readFileSync('./cert/cert.pem'),ca:fs.readFileSync('./cert/chain.pem')};
var server = https.createServer(StardustConfig, Stardust).listen(443, function() {
  console.log("Stardust online.");
});
function GetCurrentDate() {
	const date = new Date();
    return date.toUTCString();
}
function ResHeaders() {
	const Headers = {
		'date': GetCurrentDate(),
		'content-type': 'application/json;charset=utf-8',
		'connection': 'keep-alive',
		'pragma': "no-cache",
		'keep-alive': "timeout=5"
	}
	return Headers;
}

Stardust.get("/getStatus", errorhandler(async (req, res) => {
	const ResponseData = { 'clientUpdate': "0", 'message': "", 'serverStatus': "0" }
	const Serialized = JSON.stringify(ResponseData);
	res.set(ResHeaders(Serialized.length));
    res.write(Serialized); res.end();
}));

Stardust.post("/start/start", errorhandler(async (req, res) => {
	let OSType = {}; if (res.locals.RequestJSON['osType'] == 1) { OSType = { "IOS_REVIEW": 0 } } else { OSType = { "ANDROID_REVIEW": 0 } }
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"statusMap": OSType,
		"bgmDataVersion": 106,
		
		"voiceDataVersion": 102,
		"l5idUrl": {
			"web": "",
			"auth": "",
			"reg": "",
			"api": ""
		},
		"seDataVersion": 111
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/start/getPlayerInfoFromGdkey", errorhandler(async (req, res) => {
	const GameKeyList = res.locals.RequestJSON['gdkeyInfoList']
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"playerList":[
			{
				"gdkey": "390548548",
				"playerId": "rpl005056b80000a965000117d928a3a9c",
				"playerName": "Ceris",
				"searchPlayerId": "572999548",
				"sexId": 2960814355,
				"lifeId": 1324894209,
				"level": 51,
				"licenseLevel": 5,
				"star": 2770,
				"villageName": "Selenium",
				"rich": 103480,
				"lifegem": 1237,
				"lastLoginDt": Math.floor(Date.now()),
				"charaCount": 54,
				"friendCount": 17,
				"charaExistFlg": 1,
				"l5idStatusCode": 0,
				"l5idMaxStatusCode": 1
			}
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/start/loginWithGdkey", errorhandler(async (req, res) => {
	const GameKeyList = res.locals.RequestJSON['gdkeyInfoList']
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"accumulatePayGem": 0,
		"l5idMaxStatusCode": 1,
		"enableForceDl": 0,
		"carnivalCheckCode": "D6BDF8907D56F7AF1F40A18D7CA0CEC11F9ECE376AC7109F958E58EAC4EB15BC",
		"playerName": "Ceris",
		"level": 51,
		"searchPlayerId": "572999548",
		"rich": 103480,
		"l5idPrevStatusCode": 0,
		"removePaymentLogFlg": 0,
		"token": "e62938a882eb6d94c29bb0520d8e8ddf",
		"firstPaymentFlg": 1,
		"l5idStatusCode": 0,
		"buddyId": 3138420566,
		"playerId": "rpl005056b80000a965000117d928a3a9c"
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/player/getAvatarLifeEquipment", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"lifeEquipList": [
			{
				"lifeId": 730741264,
				"equipList": [ 160,0,181,178,179,0,180,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			},
			{
				"lifeId": 771723558,
				"equipList": [ 0,0,0,1,0,0,0,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			},
			{
				"lifeId": 1324894209,
				"equipList": [ 391,0,376,378,377,154,270,0,243,88,160,123,235,210,391,97,215,328,433,321,393,0,0,0,0 ],
				"appearanceList": [ 477,464,86,429,428,0,0,0,423,4294967295 ]
			},
			{
				"lifeId": 1658945291,
				"equipList": [ 243,0,175,171,172,173,174,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			},
			{
				"lifeId": 1898503243,
				"equipList": [ 123,0,254,252,0,0,253,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			},
			{
				"lifeId": 2187003451,
				"equipList": [ 210,0,301,297,298,299,300,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			},
			{
				"lifeId": 2300705121,
				"equipList": [ 132,121,395,352,497,263,270,0,243,88,160,123,235,210,391,97,423,328,433,393,321,0,0,0,0 ],
				"appearanceList": [ 4294967295,161,163,0,0,0,0,0,362,4294967295 ]
			},
			{
				"lifeId": 2524902084,
				"equipList": [ 88,0,271,261,287,263,264,0,243,88,160,123,235,210,391,97,215,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 4294967295,226,0,154,270,0,0,0,0,0 ]
			},
			{
				"lifeId": 2762901997,
				"equipList": [ 0,0,0,226,0,154,270,0,243,88,160,123,235,210,391,97,215,328,321,0,0,0,0,0,0 ],
				"appearanceList":[ 4294967295,0,0,0,0,0,76,0,0,4294967295 ]
			},
			{
				"lifeId": 3262958588,
				"equipList": [ 235,0,0,273,272,268,277,0,243,88,160,123,235,210,391,97,215,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 4294967295,226,0,154,270,0,0,0,0,0 ]
			},
			{
				"lifeId": 3355431860,
				"equipList": [ 190,0,395,226,0,411,270,0,243,88,160,123,235,210,391,97,423,328,433,393,321,0,0,0,0 ],
				"appearanceList": [ 477,436,375,429,428,0,482,0,0,4294967295 ]
			},
			{
				"lifeId": 3929318351,
				"equipList": [ 97,0,317,315,0,0,316,0,243,88,160,123,235,210,391,97,0,0,0,0,0,0,0,0,0 ],
				"appearanceList": [ 0,0,0,0,0,0,0,0,0,0 ]
			}
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/player/getPlayerNoticeList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"noticeList": [],
		"hasHalfAnniversaryReward": 0,
		"dailyAchievementRemain": 1,
		"isKickOpen": 1,
		"sharePicName": "fbShareBG.png",
		"isCarnivalOpen": 0,
		"dailyAchievementCanReport": 0,
		"isCelebrationOpen": 0,
		"achievementRemain": 1,
		"campaignQuestFreeObj": 1, 
		"unreadChatMessageCnt": 0,
		"nextDailyResetDt": 1675555200000,
		"hasCelebrationReward": 0,
		"isFever": 0,
		"isShareOpen": 1,
		"isRankingEvOpen": false,
		"isAccumulateOpen": 1,
		"isHalfAnniversaryOpen": 0,
		"receiveTradeCardList": [],
		"presentCnt": 1,
		"tryQuestRemain": 0,
		"isRecallBoardOpen": 0,
		"godAntennaNew": 0,
		"inviterCnt": 0,
		"hasAccumulateReward": 0,
		"tryQuestCanReport": 0,
		"isManualTicketOpen": 1,
		"nextWeeklyResetDt": 1675656000000,
		"doneTradeCardList": [],
		"isPushOpen": 1,
		"bazaarMaintenanceState": 0,
		"unreadMessageCnt": 0,
		"isKeyExchangeOpen": 1,
		"hasAccumulatePaymentReward": 0,
		"achievementCanReport": 1,
		"isChatOpen": 1,
		"unreadSmileCnt": 37,
		"friendRequestCnt": 0,
		"sendTradeCardList": [],
		"questMainframeImageId": 0,
		"hasDailyGiftBag": 1,
		"isAccumulatePaymentRewardOpen": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/player/getMyPlayerData", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"partyCnt": 4,
		"boostPower": 120,
		"pocketCnt": 4,
		"runeExpandStatus": 0,
		"godPower": 120,
		"boostPowerOffsetTime": 0,
		"nicknameId": 82946176,
		"dropBoostExpireDt": 0,
		"lifegem": 1237,
		"subWeaponList": [ 0,0 ],
		"itemExpandStatus": 6,
		"extraAccessorySlotStatus": 0,
		"forceRuneUpdateSeq": 0,
		"godPowerOffsetTime": 0,
		"avatarData": {
			"bodyType": 3086314178, "bodyColorR": 255, "bodyColorG": 255, "bodyColorB": 255,
			"bodyColorR2": 239, "bodyColorG2": 88, "bodyColorB2": 47,
			"faceType": 1694411773,
			"hairType": 1139352157, "hairColorR": 170, "hairColorG": 111, "hairColorB": 201,
			"eyeType": 1557743279, "eyeColorR": 6, "eyeColorG": 1, "eyeColorB": 219,
			"eyeSize": 0.92, "eyePosx": -0.125, "eyePosy": -0.25,
			"noseType": 1502293541, "noseSize": 1.0, "nosePosy": 0.0,
			"mouthType": 3021031546, "mouthSize": 1.0, "mouthPosy": 0.0,
			"browType": 3053711790, "browSize": 1.0, "browPosx": 0.0, "browPosy": 0.0,
			"earType": 3108950158,
			"feature": 1827743347,
			"voiceType": 2924224359,
			"glassesOffset": 0.0
		},
		"resurrectionCnt": 4,
		"lifeList": [
			{ "lifeId": 730741264, "exp": 52792, "licenseRank": 4, "star": 1840, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 771723558, "exp": 0, "licenseRank": 1, "star": 0, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 1324894209, "exp": 376780, "licenseRank": 5, "star": 2770, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 1658945291, "exp": 66094, "licenseRank": 4, "star": 2080, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 1898503243, "exp": 21196, "licenseRank": 4, "star": 1010, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 2187003451, "exp": 4628, "licenseRank": 3, "star": 390, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 2300705121, "exp": 318292, "licenseRank": 5, "star": 3270, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 2524902084, "exp": 62599, "licenseRank": 4, "star": 2820, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 2762901997, "exp": 65528, "licenseRank": 3, "star": 1010, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 3262958588, "exp": 18411, "licenseRank": 3, "star": 360, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 3355431860, "exp": 269845, "licenseRank": 5, "star": 3310, "masterLicenseOpenStatus": 0 },
			{ "lifeId": 3929318351, "exp": 12851, "licenseRank": 3, "star": 650, "masterLicenseOpenStatus": 0 }
		],
		"activePartyIndex": 0,
		"comebackLoginDt": 1675496410000,
		"godPoint": 400,
		"godTeamId": 2402178514,
		"appearanceList": [ 477,464,86,429,428,0,0,0,423,4294967295 ],
		"maxGodPower": 120,
		"playerName": "Ceris",
		"sexId": 2960814355,
		"merchantLevel": 1,
		"rich": 103480,
		"godBonusStack": 0,
		"facilityExpandStatus": 0,
		"warehouseExpandStatus": 0,
		"mvpCnt": 25,
		"likeCnt": 42,
		"lifeId": 1324894209,
		"equipList": [ 391,0,376,378,377,154,270,0,243,88,160,123,235,210,391,97,215,328,433,321,393,0,0,0,0 ],
		"kigurumiCnt": 4,
		"partyInfoList":[
			{ "name": "Team 1", "partyNo": 0, "partyList": [ 3250379887,3138420566,782805984,603835627 ] },
			{ "name": "Team 2", "partyNo": 1, "partyList": [ 3250379887,4030219835,3019027408,707146005 ]}
		],
		"godRank": 5,
		"buddyId": 3138420566
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/player/getPlayerRuneListBinary", errorhandler(async (req, res) => {
	const ResponseData = fs.readFileSync('./static/RuneListBinary.bin').toString('hex');
	const EnCipher = crypto.createCipheriv('aes-128-cbc', res.locals.RequestKey, res.locals.RequestIV);
	let EncData = EnCipher.update(ResponseData, 'hex', 'base64');
	EncData += EnCipher.final('base64');
	res.set(ResHeaders());
    res.write(EncData); res.end();
}));
Stardust.post("/player/getPlayerItemListBinary", errorhandler(async (req, res) => {
	const ResponseData = fs.readFileSync('./static/ItemListBinary.bin').toString('hex');
	const EnCipher = crypto.createCipheriv('aes-128-cbc', res.locals.RequestKey, res.locals.RequestIV);
	let EncData = EnCipher.update(ResponseData, 'hex', 'base64');
	EncData += EnCipher.final('base64');
	res.set(ResHeaders());
    res.write(EncData); res.end();
}));
Stardust.post("/player/getPlayerCharacter", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"charaList": StaticData.CharacterListStatic
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/player/getPlayerVillage", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"villageList": StaticData.VillageListStatic,
		"waitKigurumiNum": 4,
		"autoSyntheticList": [],
		"sharedTreasure": {
			"posX": 0,
			"posZ": 0,
			"treasureId": 2798200616
		},
		"villageWorkList": [],
		"remaingHappyEventNum": 10,
		"buildingList": [],
		"nextHappyEventResetDt": 1675555200000
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/player/getPlayerMyHouse", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"myHouseList": [
			{
				"charaList": [ 3250379887 ],
				"myRoomList": [ 
					{
						"furnitureList": [],
						"myRoomId": 2695449440
					}
				],
				"itemSeq":78
			}
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.get("/player/downloadAvatarIcon", errorhandler(async (req, res) => {
	const TargetID = req.param.targetPlayerId;
	const Serialized = fs.readFileSync('./static/PlayerAvatarIcon.jpg');
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/loginbonus/getLoginBonus", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"eventBonus": {
			"eventBonusInfo": [],
		},
		"presentCnt": 0,
		"loginBonus": {},
		"totalDay": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/flag/getFlagListAll", errorhandler(async (req, res) => {
	cconst ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"flagList": [
			1414655077,4002759918,2610466999,247817791,4041446531,3787371202,2940086564,1052566351,2327106382,2518904968,580512558,3474003201,135177626,961499014,3113450695,1069051676,251233536,3488066081,874382461,90173025,358355989,283922413,565028337,4218030187,3391873655,1128657269,1912871785,1367807473,1623654381,2159792811,2985965751,2069141223,2464950818,2746073150,1116867582,1943265762,1962788886,1169957386,3273107258,400213530,3300807743,2199793391,3195930463,207543119,826209023,3383637582,4107149310,847425066,266504090,1212349770,1965217018,3338799338,4200735066,1066585179,2306274612,1100380740,2096518132,104202388,3104227061,2135559969,1110058641,92953665,954889713,2328537569,3238514811,3329422665,1938353136,3754347575,2228378589,3163224120,644435543,3717238754,249290470,2234831750,962099933,309635939,4133955809,3375716076,522459688,2783713943,3260271034,117612294,3807723676,2349182466,2384322794,3496107193,4256145949,1688662951,329368369,2378520210,34053259,3016078569,808264451,705921661,856208188,405135615,20894142,1316964217,1466201656,2085168635,1699878074,3804891253,1915413822,48277921,701364834,819383075,1136852899,956980010,2761400853,2675789982,957463598,537562479,187162284,305983469,1568504106,1147553899,1867193256,1984965353,4056430118,1630067565,300062706,986694705,601159024,1354809840,705193337,3080035398,2629357445,2242117316,4139240004,2357161677,1915921096,1238913091,2600290360,2212919673,2831887034,2983205883,4270951740,3884629117,3433557950,3585924863,1378140720,3267637115,2987287524,2569220135,2151154022,4079760870,2313458031,343500880,798202587,2972817756,2821367837,2198338526,2585578143,3579665496,3427167513,3882565338,4268756891,2045252436,3909680671,2579673728,3002065219,2884947970,3638617218,2720546827,1068874036,345565943,226745270,2123886390,73354175,4195518394,3510621305,3357861176,3140538808,3254285617,1550158862,2001264589,1850994316,1737457285,2413002416,2529710065,3185908786,2768121203,3955211188,4070869749,3649689910,3230853239,3622443507,2803914092,2349663919,2501261294,3858891630,2630526951,22503128,712641819,862010458,1081411802,985508947,3304087638,4279931613,3036963120,2887733361,2268201906,2653500147,3513295924,3363018101,3814639286,4198889463,3980199539,2650229484,3067746607,2948671598,3704954094,2786965607,998261080,279777947,162931674,2057443162,6992851,4264001494,3574213653,3423673684,3204786644,3318582621,1481667682,1673168617,1301022940,1419196829,2142923358,1721850655,702598616,821820569,467054426,47029787,364212127,1702830848,1314025667,1464418690,610104578,1586876811,3272091828,3894770551,4047391286,2183823030,4175616575,112137786,763512313,882472120,1200439352,1027990705,2698517902,2348109389,2465103628,2603806469,658895971,1046398242,359896801,208185248,1126773095,1513226278,1897878501,1745117860,2138870560,263643071,614173820,1031847229,1318357437,878456116,2848052235,2196539336,2616702601,3907224073,2452301440,1818684037,1196144966,1582336007,1468798990,1952687470,1836618799,1180026860,1599010477,269443178,152326443,574161640,992097193,3166318438,744145453,1552977586,2008931697,1856433200,498260144,1736080441,4209476870,3238885261,528938283,111002730,766547881,883664616,2078945327,1659961710,1239175853,1355244524,1203737192,930471671,475565364,88325237,1985448181,211758204,2432881987,3123676800,2738141121,3491791681,2867341256,1420159949,1867454790,2765219556,3184187301,2531755110,2415703335,3233620960,3651539617,4069212514,3952111651,4243095975,2351091000,2802818811,3189026746,3439369018,3083354035,710264460,24679759,409183246,297743367,385415731,2335163018,865314287,556141057,2577034596,3254353202,2034571863,959282285,2173770504,2468656358,731435907,3058690874,250842207,474358705,4168028634,768225524,550130920
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/synergyBoard/getSynergyBoard", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"openBoardNo": 1,
		"synergyBoardSlotList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/collection/getCollectionMonsterInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionMonsterInfoList": StaticData.MonsterList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionPickInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionPickInfoList": StaticData.PickList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionFishInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionFishInfoList": StaticData.FishList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionRecipeInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionRecipeInfoList": StaticData.RecipeList,
		"collectionGodRecipeInfoList": StaticData.DivineRecipeList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/achievement/getAchievementCounter", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"counterList": StaticData.AchievementList,
		"godMissionCounterList": StaticData.DivineAchievementList,
		"godMissionThemeCounterList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/achievement/getGodBonusList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"godBonusList": [
			{
				"stage": 2,
				"godBonusId": 300416572
			},
			{
				"stage": 2,
				"godBonusId": 739201210
			},
			{
				"stage": 2,
				"godBonusId": 1143573002
			},
			{
				"stage": 2,
				"godBonusId": 2813030042
			}
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/achievement/getAchievementList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"starReportList": StaticData.StarReportList,
		"expertMissionList": StaticData.ExpertMissionList,
		"godMissionThemeReportList": [],
		"godMissionList": StaticData.DivineMissionList,
		"godMissionFieldList": StaticData.DivineFieldMissionList,
		"npcStateList": [
			{
				"charaId": 1093949900,
				"godRankTalkStep": 4
			},
			{
				"charaId": 2123878589,
				"godRankTalkStep": 4
			},
			{
				"charaId": 2911148419,
				"godRankTalkStep": 2
			}
		],
		"towerQuestList": [],
		"godMissionGroupList": StaticData.DivineMissionGroupList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/achievement/getAchievementMissionList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"date": "20230204",
		"achievementMonthlyQuest": StaticData.MonthlyMission,
		"achievementDailyAchievementList": [],
		"achievementDailyKeyAchievementList": [],
		"achievementDailyQuest": StaticData.DailyMission,
		"achievementTotalAchievementList": StaticData.AllAchievementList,
		"achievementTryquestAchievementList": StaticData.TryAchievementList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/achievement/getAchievement", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"date": "20230204",
		"achievementDailyAchievementList": [],
		"achievementDailyKeyAchievementList": [],
		"achievementDailyQuest": {
			"achievementId": 2283718840,
			"achievementName": "Daily Challenge",
			"questList": [
				{
					"advQuestDataId": 1512198094,
					"sortNumber": 0,
					"needCount": 1,
					"cnt": 0
				},
				{
					"advQuestDataId": 3865835670,
					"sortNumber": 0,
					"needCount": 1,
					"cnt": 0
				},
				{
					"advQuestDataId": 2952872119,
					"sortNumber": 0,
					"needCount": 1,
					"cnt": 0
				}
			],
			"clearedFlg": 0,
			"rewardList": [
				{
					"objId": 3230571857,
					"objCnt": 15
				},
				{
					"objId": 514867479,
					"objCnt": 2
				},
				{
					"objId": 2720144838,
					"objCnt": 2
				}
			],
			"startDt": 1675468800000,
			"endDt": 1675555199000
		},
		"achievementTotalAchievementList": [],
		"achievementTryquestAchievementList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/notice/getNoticeList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"noticeList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/notice/getExtNoticeList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"noticeList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/teamEventRanking/getOpenStatus", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"status": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/teamEventRanking/getSchedule", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"seasonId": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/adventure/saveIs", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"isData": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/event/eventQuestList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"questList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/villagemultiplay/getMultiQuestData", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"eventQuestList": {
			"questList": []
		},
		"getCampaignList": {
			"advQuestGroupList": []
		},
		"getAdvQuestList": {
			"feverAdvQuestGroupList": [],
			"advQuestHistList": [],
			"clearAdvQuestIdList": []
		}
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/villagemultiplay/getRecallMultiQuestData", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"eventGroupList": [],
		"eventQuestList": {},
		"getCampaignList": {},
		"getAdvQuestList": {}
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.post("/payment/getProductItemList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"isAgeVerify": 1,
		"productItemList": [],
		"monthlyLimit": -1,
		"useAmount": 0,
		"hasIncompleteOrder": false
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/premiumpass/getPremiumPassList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"storePremiumPassList":[],
		"lifegemPay": 0,
		"premiumPassCanNotBuyList": [],
		"lifegemFree": 10000,
		"premiumPassBuyCntList": [],
		"premiumPassList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));
Stardust.post("/shop/getItemGodList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"godItemList":[],
		"lifegemPay": 0,
		"lifegemFree": 10000,
		"godItemPackList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders());
    res.write(Serialized); res.end();
}));

Stardust.all("*", async (req, res) => {
	console.log("Request on URL " + req.url);
	if (req.get('content-type') == "application/json") {
		const RequestData = DecryptData(req.body);
		const RequestJSON = RequestData[1];
		console.log(RequestData[0].toString('hex'), RequestData[2].toString('hex'));
		console.log(RequestJSON);
	}
	res.status(500);
	res.end();
});