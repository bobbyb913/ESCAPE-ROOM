#include <FastLED.h>
#include <NimBLEDevice.h>

static constexpr char kDeviceName[] = "Atlas-Lights";
static constexpr char kServiceUuid[] = "8d53dc1d-1db7-4cd3-868b-8a527460aa84";
static constexpr char kStateCharacteristicUuid[] = "da7b53c1-5b63-4d58-ae7e-8904b215e68c";
static constexpr char kWinCharacteristicUuid[] = "c7858c1a-6c8b-4a43-9a9d-b9a420e94801";
static constexpr uint8_t kLedDataPin = 13;
static constexpr uint16_t kLedCount = 100;
static constexpr uint8_t kLedBrightness = 150;
static constexpr uint8_t kWinButtonPin = 27;
static constexpr uint32_t kButtonDebounceMs = 40;
static constexpr uint32_t kRedPulseFrameIntervalMs = 20;
static constexpr uint32_t kRedPulsePeriodMs = 2000;
static constexpr uint32_t kCelebrationFrameIntervalMs = 20;

CRGB leds[kLedCount];

enum class LightState : uint8_t {
  Idle,
  FlashingRed,
  SolidRed,
  Celebration
};

static portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;
static volatile LightState requestedState = LightState::Idle;
static LightState activeState = LightState::Idle;
static NimBLECharacteristic* winCharacteristic = nullptr;
static int lastButtonReading = HIGH;
static int stableButtonState = HIGH;
static uint32_t lastButtonChangeMs = 0;
static uint32_t lastPatternUpdateMs = 0;
static uint8_t celebrationHue = 0;

bool parseLightState(const std::string& value, LightState& state) {
  if (value == "idle") {
    state = LightState::Idle;
    return true;
  }
  if (value == "flashing_red") {
    state = LightState::FlashingRed;
    return true;
  }
  if (value == "solid_red") {
    state = LightState::SolidRed;
    return true;
  }
  if (value == "celebration") {
    state = LightState::Celebration;
    return true;
  }
  return false;
}

class LightStateCallbacks final : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo&) override {
    LightState newState;
    if (!parseLightState(characteristic->getValue(), newState)) {
      Serial.println("Ignored unknown light state.");
      return;
    }

    portENTER_CRITICAL(&stateMux);
    requestedState = newState;
    portEXIT_CRITICAL(&stateMux);
  }
};

class ServerCallbacks final : public NimBLEServerCallbacks {
  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
    NimBLEDevice::startAdvertising();
  }
};

void applyLightState(LightState state) {
  switch (state) {
    case LightState::Idle:
      FastLED.clear();
      break;
    case LightState::FlashingRed:
      fill_solid(leds, kLedCount, CRGB::Red);
      break;
    case LightState::SolidRed:
      fill_solid(leds, kLedCount, CRGB::Red);
      break;
    case LightState::Celebration:
      celebrationHue = 0;
      fill_rainbow(leds, kLedCount, celebrationHue, 7);
      break;
  }
  FastLED.show();
  lastPatternUpdateMs = millis();

  Serial.print("Light state: ");
  switch (state) {
    case LightState::Idle:
      Serial.println("idle");
      break;
    case LightState::FlashingRed:
      Serial.println("flashing_red");
      break;
    case LightState::SolidRed:
      Serial.println("solid_red");
      break;
    case LightState::Celebration:
      Serial.println("celebration");
      break;
  }
}

void updateLightPattern() {
  const uint32_t now = millis();
  if (activeState == LightState::FlashingRed &&
      now - lastPatternUpdateMs >= kRedPulseFrameIntervalMs) {
    const uint8_t phase = static_cast<uint8_t>(
      (now % kRedPulsePeriodMs) * 256UL / kRedPulsePeriodMs
    );
    const uint8_t redLevel = sin8(phase);
    fill_solid(leds, kLedCount, CRGB(redLevel, 0, 0));
    FastLED.show();
    lastPatternUpdateMs = now;
  } else if (activeState == LightState::Celebration &&
             now - lastPatternUpdateMs >= kCelebrationFrameIntervalMs) {
    celebrationHue += 2;
    fill_rainbow(leds, kLedCount, celebrationHue, 7);
    FastLED.show();
    lastPatternUpdateMs = now;
  }
}

void setup() {
  Serial.begin(115200);

  FastLED.addLeds<WS2812B, kLedDataPin, GRB>(leds, kLedCount);
  FastLED.setBrightness(kLedBrightness);
  FastLED.clear(true);

  NimBLEDevice::init(kDeviceName);
  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  NimBLEService* service = server->createService(kServiceUuid);
  NimBLECharacteristic* stateCharacteristic = service->createCharacteristic(
    kStateCharacteristicUuid,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  stateCharacteristic->setCallbacks(new LightStateCallbacks());
  stateCharacteristic->setValue("idle");

  winCharacteristic = service->createCharacteristic(
    kWinCharacteristicUuid,
    NIMBLE_PROPERTY::NOTIFY
  );
  winCharacteristic->setValue("");

  service->start();
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(kServiceUuid);
  advertising->start();

  pinMode(kWinButtonPin, INPUT_PULLUP);
  lastButtonReading = digitalRead(kWinButtonPin);
  stableButtonState = lastButtonReading;

  Serial.println("Atlas-Lights BLE controller ready.");
}

void loop() {
  const int buttonReading = digitalRead(kWinButtonPin);
  if (buttonReading != lastButtonReading) {
    lastButtonReading = buttonReading;
    lastButtonChangeMs = millis();
  }

  if (buttonReading != stableButtonState &&
      millis() - lastButtonChangeMs >= kButtonDebounceMs) {
    stableButtonState = buttonReading;
    if (stableButtonState == LOW) {
      winCharacteristic->setValue("win");
      winCharacteristic->notify();
      Serial.println("Win button pressed; sent BLE win event.");
    }
  }

  LightState nextState;
  portENTER_CRITICAL(&stateMux);
  nextState = requestedState;
  portEXIT_CRITICAL(&stateMux);

  if (nextState != activeState) {
    activeState = nextState;
    applyLightState(activeState);
  }

  updateLightPattern();
  delay(1);
}
