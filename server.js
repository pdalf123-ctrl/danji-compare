const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = '323236440145e1410e54b159179e1bfbb24b98fafd58a57d0047a9b4c12dadf8';
const TRADE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RENT_URL  = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';

app.get('/api/trade', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const response = await axios.get(TRADE_URL, {
      params: { serviceKey: API_KEY, numOfRows: 1000, pageNo: 1, LAWD_CD, DEAL_YMD }
    });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/rent', async (req, res) => {
  try {
    const { LAWD_CD, DEAL_YMD } = req.query;
    const response = await axios.get(RENT_URL, {
      params: { serviceKey: API_KEY, numOfRows: 1000, pageNo: 1, LAWD_CD, DEAL_YMD }
    });
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행중: 포트 ${PORT}`));
