# Wyboryzator 2024

Wyboryzator 2024 to aplikacja internetowa służąca do eksploracji oficjalnych wyników wyborów samorządowych 2024 w Polsce (rady gmin powyżej 20 tys. mieszkańców). Jej unikalną funkcją jest możliwość tworzenia **wirtualnych okręgów wyborczych** poprzez łączenie dowolnych obwodów głosowania w obrębie gminy i symulowanie podziału mandatów.

## Główne funkcje

- **Przeglądarka Gmin**: Wyszukiwanie i wybór spośród ponad 320 gmin.
- **Przegląd Gminy**: Sprawdzanie rzeczywistych wyników, podziału mandatów, frekwencji i szczegółów dla okręgów i obwodów głosowania.
- **Kreator Wirtualnych Okręgów** (Killer Feature):
  - Wybieranie dowolnych obwodów głosowania z różnych rzeczywistych okręgów.
  - Elastyczne przeliczanie mandatów z automatycznie podpowiadaną domyślną liczbą mandatów na podstawie proporcji wyborców.
  - **Przełącznik metod**: Symulacja podziału mandatów dwiema metodami: **d'Hondta** (ustawowa) i **Sainte-Laguë** (hipotetyczna).
  - Analiza głosów: Aplikacja wylicza **brakujące głosy** (ile głosów zabrakło do kolejnego mandatu), **głosy zmarnowane** (oddane na komitety bez mandatu) i **głosy nadwyżkowe**.
- **Linkowanie stanu**: Możliwość udostępniania stworzonych wirtualnych okręgów i wyników za pomocą linku.

## Technologie

- **Frontend**: [Preact](https://preactjs.com/) + [TypeScript](https://www.typescriptlang.org/)
- **Budowanie i serwowanie**: [Vite](https://vitejs.dev/)
- **Zarządzanie pakietami**: [pnpm](https://pnpm.io/)
- **Architektura Danych**: Aplikacja jest w pełni statyczna (Client-side), nie wymaga backendu. Dane wyborcze są serwowane w formie statycznych plików JSON dla każdej gminy.

## Instalacja i uruchomienie lokalne

Upewnij się, że masz zainstalowany Node.js w wersji 22 oraz `pnpm`.

1. Klonowanie repozytorium (jeśli jeszcze tego nie zrobiono):
   ```bash
   git clone <adres-repozytorium>
   cd wyboryzator2024
   ```

2. Instalacja zależności:
   ```bash
   pnpm install
   ```

3. Uruchomienie deweloperskie (Live Reload):
   ```bash
   pnpm run dev
   ```

4. Budowanie wersji produkcyjnej:
   ```bash
   pnpm run build
   ```

5. Uruchomienie testów:
   ```bash
   pnpm run test
   ```

## Deploy

Projekt jest zoptymalizowany pod kątem wdrożenia na GitHub Pages z wykorzystaniem GitHub Actions (plik `.github/workflows/deploy.yml`). Zbudowane pliki trafiają do katalogu `dist`.
Upewnij się, że w ustawieniach repozytorium GitHub Pages jako źródło (Source) ustawiono **"GitHub Actions"**.

## Licencja

Więcej informacji w pliku `LICENSE`.
