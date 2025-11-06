# 🤖 NETZ Sanal Sekreter

AI-powered virtual secretary system with Google Voice integration for NETZ Informatique.

## 📋 Proje Özeti

Bu sistem, gelen telefon çağrılarını karşılayan, çağrı sahibinin amacını anlayan ve şirket bilgi kaynaklarından (Gmail, Google Drive, Calendar, Contacts) yararlanarak **RAG (Retrieval-Augmented Generation)** yöntemiyle akıllı yanıtlar veren bir sanal sekreter çözümüdür.

## 🎯 Özellikler

- ✅ **Sesli IVR + Doğal Konuşma** (TR/FR)
- ✅ **Intent Detection & Slot Extraction**
- ✅ **Google Workspace Entegrasyonu** (Gmail, Drive, Calendar, Contacts)
- ✅ **RAG Sistemi** - Şirket dokümanlarından bilgi çekme
- ✅ **Realtime STT/TTS** - Google Cloud Speech
- ✅ **LLM Orchestration** - OpenAI/Vertex AI
- ✅ **Agent Handoff** - Canlı temsilciye akıllı devir
- ✅ **n8n Workflow Integration**
- ✅ **GDPR/KVKK Uyumlu** - PII masking, audit logs

## 🏗️ Mimari

```
┌─────────────┐
│   PSTN      │
│  (Telefon)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Telephony Gateway                   │
│  • Twilio (Seçenek B)               │
│  • Dialogflow CX (Seçenek A)        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  STT (Speech-to-Text)               │
│  Google Cloud Speech-to-Text        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Conversational Orchestrator        │
│  • Intent Detection                 │
│  • Policy Engine                    │
│  • Tool Router                      │
└──────┬──────────────────────────────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ RAG Service │    │  LLM API    │
│  (Vectors)  │    │ OpenAI/GCP  │
└──────┬──────┘    └──────┬──────┘
       │                  │
       └────────┬─────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Google Workspace Connectors        │
│  • Gmail      • Calendar            │
│  • Drive      • Contacts            │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  TTS (Text-to-Speech)               │
│  Google Cloud Text-to-Speech        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Response / Agent Handoff           │
└─────────────────────────────────────┘
```

## 📂 Proje Yapısı

```
sanal-sekreter/
├── src/
│   ├── index.js                    # Ana giriş noktası
│   ├── config/                     # Konfigürasyon
│   │   ├── index.js
│   │   ├── google-workspace.js
│   │   ├── telephony.js
│   │   └── database.js
│   ├── services/                   # İş mantığı servisleri
│   │   ├── telephony/
│   │   │   ├── twilio.service.js
│   │   │   └── dialogflow.service.js
│   │   ├── speech/
│   │   │   ├── stt.service.js
│   │   │   └── tts.service.js
│   │   ├── llm/
│   │   │   ├── orchestrator.service.js
│   │   │   ├── openai.service.js
│   │   │   └── vertexai.service.js
│   │   ├── rag/
│   │   │   ├── rag.service.js
│   │   │   ├── embeddings.service.js
│   │   │   └── vector-store.service.js
│   │   ├── google-workspace/
│   │   │   ├── gmail.service.js
│   │   │   ├── drive.service.js
│   │   │   ├── calendar.service.js
│   │   │   └── contacts.service.js
│   │   ├── intent/
│   │   │   ├── intent-detector.service.js
│   │   │   └── router.service.js
│   │   └── n8n/
│   │       └── n8n.service.js
│   ├── controllers/                # HTTP kontrolörler
│   │   ├── call.controller.js
│   │   ├── webhook.controller.js
│   │   └── admin.controller.js
│   ├── middleware/                 # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── validation.middleware.js
│   │   └── error.middleware.js
│   ├── models/                     # Veri modelleri
│   │   ├── call.model.js
│   │   ├── transcript.model.js
│   │   └── document.model.js
│   ├── utils/                      # Yardımcı fonksiyonlar
│   │   ├── logger.js
│   │   ├── security.js
│   │   └── helpers.js
│   └── websocket/                  # WebSocket handlers
│       ├── server.js
│       └── handlers.js
├── scripts/                        # Yardımcı scriptler
│   ├── setup-db.js
│   ├── seed-vectors.js
│   └── test-call.js
├── tests/                          # Testler
│   ├── unit/
│   └── integration/
├── docs/                           # Dokümantasyon
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── SECURITY.md
├── n8n-workflows/                  # n8n workflow JSON'ları
│   ├── call-logging.json
│   ├── email-notification.json
│   └── crm-sync.json
├── database/                       # Veritabanı migrations
│   ├── migrations/
│   └── seeds/
├── .env.example
├── .gitignore
├── package.json
├── docker-compose.yml
└── README.md
```

## 🚀 Kurulum

### Gereksinimler

- Node.js v18+
- PostgreSQL 14+ (pgvector extension ile)
- Redis 6+
- Google Cloud Project (Speech, Text-to-Speech API'leri aktif)
- Google Workspace hesabı (OAuth 2.0 credentials)
- Twilio hesabı (veya Dialogflow CX)
- OpenAI API key

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone https://github.com/netz-informatique/sanal-sekreter.git
cd sanal-sekreter
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Environment variables ayarlayın**
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

4. **PostgreSQL + pgvector kurulumu**
```bash
# Docker ile:
docker-compose up -d postgres redis

# Veya manuel:
npm run setup:db
```

5. **Google Cloud Service Account**
```bash
# service-account.json dosyasını proje kök dizinine koyun
export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
```

6. **Geliştirme modunda çalıştırın**
```bash
npm run dev
```

## 🔧 Konfigürasyon

### Google Workspace OAuth 2.0 Scopes

Aşağıdaki scope'ları OAuth consent screen'de ekleyin:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/contacts.readonly`

### Twilio Webhook URLs

Twilio console'da aşağıdaki webhook URL'lerini ayarlayın:

- Voice URL: `https://your-domain.com/api/webhooks/twilio/voice`
- Status Callback: `https://your-domain.com/api/webhooks/twilio/status`

## 📡 API Endpoints

### Calls

- `POST /api/calls/inbound` - Yeni çağrı başlat
- `GET /api/calls/:id` - Çağrı detayları
- `GET /api/calls/:id/transcript` - Çağrı transkripti

### Webhooks

- `POST /api/webhooks/twilio/voice` - Twilio voice webhook
- `POST /api/webhooks/twilio/status` - Twilio status callback
- `POST /api/webhooks/dialogflow` - Dialogflow webhook

### Admin

- `GET /api/admin/calls` - Tüm çağrıları listele
- `GET /api/admin/metrics` - Sistem metrikleri
- `POST /api/admin/rag/reindex` - RAG index yeniden oluştur

## 🧪 Test

```bash
# Tüm testleri çalıştır
npm test

# Unit testler
npm run test:unit

# Integration testler
npm run test:integration

# Test çağrısı simülasyonu
npm run test:call
```

## 📊 Monitoring

### Metrics

- Çağrı başarı oranı
- Ortalama karşılama süresi
- STT/TTS doğruluğu
- Intent detection doğruluğu
- RAG hit rate

### Logs

Loglar `logs/` klasöründe saklanır:
- `app.log` - Genel uygulama logları
- `error.log` - Hata logları
- `calls.log` - Çağrı logları

## 🔒 Güvenlik

- ✅ PII masking (transkriptlerde kişisel veri maskeleme)
- ✅ Encryption at rest (veritabanı şifreleme)
- ✅ OAuth 2.0 authentication
- ✅ Rate limiting
- ✅ GDPR/KVKK uyumlu veri saklama
- ✅ Audit logs

## 📚 Dokümantasyon

Detaylı dokümantasyon için `docs/` klasörüne bakın:

- [API Dokümantasyonu](docs/API.md)
- [Deployment Rehberi](docs/DEPLOYMENT.md)
- [Güvenlik En İyi Pratikler](docs/SECURITY.md)

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'feat: Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👥 İletişim

**NETZ Informatique**
- Website: https://netzinformatique.vercel.app
- Email: contact@netz-informatique.fr
- GitHub: https://github.com/lekesiz/netzinformatique

---

🤖 Yapay zeka ile güçlendirilmiş, insan dokunuşuyla geliştirilmiştir.
