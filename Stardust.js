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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/player/getAvatarLifeEquipment", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"lifeEquipList": StaticData.LifeGearList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.get("/player/downloadAvatarIcon", errorhandler(async (req, res) => {
	const TargetID = req.param.targetPlayerId;
	const Serialized = fs.readFileSync('./static/PlayerAvatarIcon.jpg');
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/loginbonus/getLoginBonus", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		// "eventBonus": StaticData.EventLoginBonus,
		"eventBonus": {
			"eventBonusInfo": []
		},
		"presentCnt": 0,
		// "loginBonus": StaticData.LoginBonus,
		"totalDay": 1
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/flag/getFlagListAll", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"flagList": StaticData.FlagList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/flag/setFlagList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"resultItemList": [],
		"resultCharaList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/synergyBoard/getSynergyBoard", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"openBoardNo": 1,
		"synergyBoardSlotList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/collection/getCollectionMonsterInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionMonsterInfoList": StaticData.MonsterList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionPickInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionPickInfoList": StaticData.PickList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionFishInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionFishInfoList": StaticData.FishList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/collection/getCollectionRecipeInfo", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"collectionRecipeInfoList": StaticData.RecipeList,
		"collectionGodRecipeInfoList": StaticData.DivineRecipeList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/achievement/getAchievementCounter", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"counterList": StaticData.AchievementList,
		"godMissionCounterList": StaticData.DivineAchievementList,
		"godMissionThemeCounterList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/license/getLifeAltar", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus }
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/notice/getNoticeList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"noticeList": StaticData.NoticeList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/notice/getExtNoticeList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"noticeList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/exchangeBoard/getExchangeBoardMissionList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"date": "20230204",
		"completeState": 0,
		"exchangeBoardDeliveryEquipMissionList": StaticData.ExchangeBoardEquipDeliveryList,
		"exchangeBoardTotalMissionList": [],
		"exchangeBoardActionMissionList": [],
		"existCompleteReward": 0,
		"exchangeBoardDeliveryMissionList": StaticData.ExchangeBoardMissionDeliveryList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/teamEventRanking/getOpenStatus", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"status": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/teamEventRanking/getSchedule", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"seasonId": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/adventure/saveIs", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"isData": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.post("/event/eventQuestList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"questList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/villagemultiplay/getMultiQuestData", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"eventQuestList": StaticData.EventQuestList,
		"getCampaignList": StaticData.CampaignList,
		"getAdvQuestList": StaticData.AdventureList
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/villagemultiplay/getRecallMultiQuestData", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"eventGroupList": [],
		"eventQuestList": {},
		"getCampaignList": {},
		"getAdvQuestList": {}
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/village/enterVillage", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"unreadSmileCnt": 0,
		"godBoardCanReport": 0,
		"recallGodBoardCanReport": 0,
		"inviteCampaignStatus": 0,
		"inviteCampaignId": 4029964763,
		"updateGodMissionGroupList": [],
		"gachaFreeType": 1,
		"isEnchantRecovery": 0,
		"godBoardWeeklyRemain": 0
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/village/getVisitorList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"visitorList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/happy/happyTaxCollect", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"happyBoost": 1,
		"charaObjIdList": [
			3519902844,
			1274106069
		],
		"totalHappyTax": 28,
		"happyTaxList": [
			{
				"happy": 4.2,
				"cnt": 21,
				"awaken": 0
			},
			{
				"happy": 3.2,
				"cnt": 8,
				"awaken": 1
			},
			{
				"happy": 6,
				"cnt": 10,
				"awaken": 2
			},
			{
				"happy": 2.4,
				"cnt": 3,
				"awaken": 3
			},
			{
				"happy": 12,
				"cnt": 12,
				"awaken": 4
			}
		]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
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
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/premiumitempack/activation", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"premiumItemPackList":[]
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));
Stardust.post("/shop/getItemGodList", errorhandler(async (req, res) => {
	const ResponseData = { "resultCodeStatus": res.locals.ResultStatus, "systemStatus": res.locals.SystemStatus,
		"godItemList":[],
		"lifegemPay": 0,
		"lifegemFree": 10000,
		"godItemPackList": []
	}
	const Serialized = EncryptData(res.locals.RequestIV, JSON.stringify(ResponseData), res.locals.RequestKey);
	res.set(ResHeaders()); res.write(Serialized); res.end();
}));

Stardust.all("*", async (req, res) => {
	console.log("Request on URL " + req.url);
	res.status(500);
	res.end();
});