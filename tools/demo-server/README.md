# demo-server

Prosty serwer testowy IPTV dla vMUX. Przyjmuje ingest RTMP i generuje HLS do szybkiego podpięcia w panelu.

## Wymagania

- Node.js 20+
- `ffmpeg` dostępny w `PATH`

## Start

```bash
cd tools/demo-server
pnpm install
pnpm start
```

Po uruchomieniu serwer wypisze:

- adres RTMP do nadawania,
- adres HLS do ustawienia w kanale IPTV,
- lokalny adres strony pomocy.

## Jak dodać testowy kanał do vMUX

1. Uruchom serwer.
2. Wyślij testowy stream na adres RTMP z konsoli albo ze strony pomocy.
3. W vMUX przejdź do edycji kanału IPTV.
4. Ustaw:
   - `Adres strumienia` = adres HLS `http://HOST:8000/live/demo/index.m3u8`
   - `Protokół strumienia` = `HLS`
5. Zapisz kanał i sprawdź podgląd w emulatorze (`OK` na pilocie).

## Przykład testowego publish z pliku MP4

```bash
ffmpeg -re -stream_loop -1 -i ./sample.mp4 \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -c:a aac -ar 48000 -b:a 128k \
  -f flv rtmp://127.0.0.1:1935/live/demo
```

Możesz zmienić nazwę streamu, np. `demo2`. Wtedy playback będzie pod adresem:

```text
http://127.0.0.1:8000/live/demo2/index.m3u8
```
