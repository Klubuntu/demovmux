# input-emulators (vMUX)

Zestaw lokalnych emulatorów źródeł wejściowych dla panelu vMUX.

Obsługiwane profile:

- Backhaul · IP Multicast
- IP/SRT · SRT
- IP/SRT · SRT (AES-128)
- Satelita · DVB-S2
- Off-Air · DVB-T2
- Radiolinia · E1/IP
- Światłowód · ASI/SDI

## Dlaczego kilka osobnych emulatorów?

Tu zastosowano **6 osobnych procesów adapterów** uruchamianych przez jeden lekki supervisor.
To daje:

- lepszą izolację (awaria jednego profilu nie ubija reszty),
- łatwiejszy restart i diagnostykę,
- prostsze skalowanie / zmianę parametrów per profil,
- niższe ryzyko wzajemnego blokowania pętli event-loop.

## Uruchomienie

```bash
pnpm --dir tools/input-emulators start
```

Dashboard statusów:

- http://127.0.0.1:8020

W dashboardzie widać teraz kolumnę **Podłączone urządzenia** (aktywni nadawcy wykryci po IP:port).

## Mapowanie do panelu "Strumienie wejściowe"

Po starcie serwer wypisuje gotowe wartości dla pól:

- `type`
- `protocol`
- `source_address`
- `source_port`

Przykład (Backhaul):

- `type=backhaul`
- `protocol=IP Multicast`
- `source_address=239.10.10.10`
- `source_port=5000`

## Jak zasilić "wirtualną satelitę" (DVB-S2 relay) w labie

Profil satelitarny działa w trybie **relay**:

- ingress (uplink do satelity): `udp://127.0.0.1:15300`
- egress (wyjście do vMUX): `127.0.0.1:5300`

### 1) Nadawanie testowe z FFmpeg (symulacja encodera studyjnego)

```bash
ffmpeg -re -stream_loop -1 -i ./sample.mp4 -c:v libx264 -preset veryfast -tune zerolatency -c:a aac -ar 48000 -f mpegts "udp://127.0.0.1:15300?pkt_size=1316"
```

Po chwili w dashboardzie pojawi się urządzenie w kolumnie „Podłączone urządzenia”.

### 2) OBS -> wirtualna satelita

OBS najłatwiej podać przez pośrednika FFmpeg:

- OBS nadaje RTMP/SRT do lokalnego endpointu,
- FFmpeg robi bridge do `udp://127.0.0.1:15300`.

Przykład bridge SRT -> satelita relay:

```bash
ffmpeg -i "srt://0.0.0.0:20000?mode=listener&latency=120" -c copy -f mpegts "udp://127.0.0.1:15300?pkt_size=1316"
```

Wtedy w OBS ustaw wyjście SRT na `srt://127.0.0.1:20000?mode=caller&latency=120`.

## SRT AES-128 (profil IP/SRT)

Dla profilu `IP/SRT · SRT (AES-128)` w logu startowym dostajesz gotowy URL i hasło testowe.
W panelu ustaw:

- `type=ip_srt`
- `protocol=SRT`
- `encryption=AES-128`

## Uwaga

To emulatory testowe ruchu TS po UDP i metryk wejść. Nie zastępują pełnych profesjonalnych modulatorów / IRD / bram SDI.
