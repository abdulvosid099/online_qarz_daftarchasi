package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const port = ":4000"

var db *sql.DB

type Mijoz struct {
	ID      int    `json:"id"`
	Ism     string `json:"ism"`
	Telefon string `json:"telefon"`
	Manzil  string `json:"manzil"`
	Izoh    string `json:"izoh"`
}

type Qarz struct {
	ID        int     `json:"id"`
	MijozID   int     `json:"mijoz_id"`
	MijozIsmi string  `json:"mijoz_ismi"`
	Summa     float64 `json:"summa"`
	Qoldiq    float64 `json:"qoldiq"`
	Izoh      string  `json:"izoh"`
	Sana      string  `json:"sana"`
}

type MijozKiritish struct {
	Ism     string `json:"ism"`
	Telefon string `json:"telefon"`
	Manzil  string `json:"manzil"`
	Izoh    string `json:"izoh"`
}

type QarzKiritish struct {
	MijozID int     `json:"mijoz_id"`
	Summa   float64 `json:"summa"`
	Izoh    string  `json:"izoh"`
}

type TolovKiritish struct {
	Summa float64 `json:"summa"`
	Izoh  string  `json:"izoh"`
}

func jsonYubor(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func xato(w http.ResponseWriter, status int, matn string) {
	jsonYubor(w, status, map[string]string{
		"xabar": matn,
	})
}

func jsonOqish(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, OPTIONS",
		)
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func metodTekshir(w http.ResponseWriter, r *http.Request, metod string) bool {
	if r.Method != metod {
		w.Header().Set("Allow", metod)
		xato(w, http.StatusMethodNotAllowed, "Bu so'rov usuli qo'llab-quvvatlanmaydi.")
		return false
	}
	return true
}

func bazaYaratish() error {
	jadvallar := []string{
		`CREATE TABLE IF NOT EXISTS mijozlar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ism TEXT NOT NULL,
			telefon TEXT NOT NULL DEFAULT '',
			manzil TEXT NOT NULL DEFAULT '',
			izoh TEXT NOT NULL DEFAULT '',
			yaratilgan_vaqt TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS qarzlar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mijoz_id INTEGER NOT NULL,
			summa REAL NOT NULL CHECK (summa > 0),
			qoldiq REAL NOT NULL CHECK (qoldiq >= 0),
			izoh TEXT NOT NULL DEFAULT '',
			sana TEXT NOT NULL,
			FOREIGN KEY (mijoz_id)
				REFERENCES mijozlar(id)
		)`,
		`CREATE TABLE IF NOT EXISTS tolovlar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			qarz_id INTEGER NOT NULL,
			summa REAL NOT NULL CHECK (summa > 0),
			izoh TEXT NOT NULL DEFAULT '',
			sana TEXT NOT NULL,
			FOREIGN KEY (qarz_id)
				REFERENCES qarzlar(id)
		)`,
	}

	for _, sqlMatn := range jadvallar {
		if _, err := db.Exec(sqlMatn); err != nil {
			return fmt.Errorf("jadval yaratilmadi: %w", err)
		}
	}

	return nil
}

func mijozlarHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`
			SELECT id, ism, telefon, manzil, izoh
			FROM mijozlar
			ORDER BY id DESC
		`)
		if err != nil {
			xato(w, http.StatusInternalServerError, "Mijozlarni olishda xato.")
			return
		}
		defer rows.Close()

		mijozlar := make([]Mijoz, 0)

		for rows.Next() {
			var m Mijoz
			if err := rows.Scan(
				&m.ID, &m.Ism, &m.Telefon, &m.Manzil, &m.Izoh,
			); err != nil {
				xato(w, http.StatusInternalServerError, "Mijoz ma'lumotini o'qib bo'lmadi.")
				return
			}
			mijozlar = append(mijozlar, m)
		}

		if err := rows.Err(); err != nil {
			xato(w, http.StatusInternalServerError, "Mijozlar ro'yxatini o'qishda xato.")
			return
		}

		jsonYubor(w, http.StatusOK, mijozlar)

	case http.MethodPost:
		var m MijozKiritish

		if err := jsonOqish(r, &m); err != nil {
			xato(w, http.StatusBadRequest, "Mijoz ma'lumotlari noto'g'ri.")
			return
		}

		m.Ism = strings.TrimSpace(m.Ism)
		m.Telefon = strings.TrimSpace(m.Telefon)
		m.Manzil = strings.TrimSpace(m.Manzil)
		m.Izoh = strings.TrimSpace(m.Izoh)

		if m.Ism == "" {
			xato(w, http.StatusBadRequest, "Mijoz ismini kiriting.")
			return
		}

		if len(m.Ism) > 150 || len(m.Telefon) > 40 ||
			len(m.Manzil) > 300 || len(m.Izoh) > 1000 {
			xato(w, http.StatusBadRequest, "Kiritilgan matn belgilangan uzunlikdan oshdi.")
			return
		}

		natija, err := db.Exec(`
			INSERT INTO mijozlar
				(ism, telefon, manzil, izoh, yaratilgan_vaqt)
			VALUES (?, ?, ?, ?, ?)
		`,
			m.Ism, m.Telefon, m.Manzil, m.Izoh,
			time.Now().Format(time.RFC3339),
		)
		if err != nil {
			xato(w, http.StatusInternalServerError, "Mijozni saqlashda xato.")
			return
		}

		id, err := natija.LastInsertId()
		if err != nil {
			xato(w, http.StatusInternalServerError, "Mijoz ID raqamini olishda xato.")
			return
		}

		jsonYubor(w, http.StatusCreated, Mijoz{
			ID: int(id), Ism: m.Ism,
			Telefon: m.Telefon, Manzil: m.Manzil, Izoh: m.Izoh,
		})

	default:
		metodTekshir(w, r, "GET, POST")
	}
}

func qarzlarHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`
			SELECT q.id, q.mijoz_id, m.ism,
			       q.summa, q.qoldiq, q.izoh, q.sana
			FROM qarzlar q
			JOIN mijozlar m ON m.id = q.mijoz_id
			ORDER BY q.id DESC
		`)
		if err != nil {
			xato(w, http.StatusInternalServerError, "Qarzlarni olishda xato.")
			return
		}
		defer rows.Close()

		qarzlar := make([]Qarz, 0)

		for rows.Next() {
			var q Qarz
			if err := rows.Scan(
				&q.ID, &q.MijozID, &q.MijozIsmi,
				&q.Summa, &q.Qoldiq, &q.Izoh, &q.Sana,
			); err != nil {
				xato(w, http.StatusInternalServerError, "Qarz ma'lumotini o'qishda xato.")
				return
			}
			qarzlar = append(qarzlar, q)
		}

		if err := rows.Err(); err != nil {
			xato(w, http.StatusInternalServerError, "Qarzlar ro'yxatini o'qishda xato.")
			return
		}

		jsonYubor(w, http.StatusOK, qarzlar)

	case http.MethodPost:
		var q QarzKiritish

		if err := jsonOqish(r, &q); err != nil {
			xato(w, http.StatusBadRequest, "Qarz ma'lumotlari noto'g'ri.")
			return
		}

		q.Izoh = strings.TrimSpace(q.Izoh)

		if q.MijozID <= 0 {
			xato(w, http.StatusBadRequest, "Mijozni tanlang.")
			return
		}
		if q.Summa <= 0 || q.Summa > 1e12 {
			xato(w, http.StatusBadRequest, "Qarz summasi musbat va ruxsat etilgan chegarada bo'lishi kerak.")
			return
		}
		if len(q.Izoh) > 1000 {
			xato(w, http.StatusBadRequest, "Izoh juda uzun.")
			return
		}

		var mavjudID int
		err := db.QueryRow(
			"SELECT id FROM mijozlar WHERE id = ?",
			q.MijozID,
		).Scan(&mavjudID)

		if errors.Is(err, sql.ErrNoRows) {
			xato(w, http.StatusNotFound, "Bunday mijoz topilmadi.")
			return
		}
		if err != nil {
			xato(w, http.StatusInternalServerError, "Mijozni tekshirishda xato.")
			return
		}

		sana := time.Now().Format(time.RFC3339)

		natija, err := db.Exec(`
			INSERT INTO qarzlar
				(mijoz_id, summa, qoldiq, izoh, sana)
			VALUES (?, ?, ?, ?, ?)
		`, q.MijozID, q.Summa, q.Summa, q.Izoh, sana)

		if err != nil {
			xato(w, http.StatusInternalServerError, "Qarzni saqlashda xato.")
			return
		}

		id, err := natija.LastInsertId()
		if err != nil {
			xato(w, http.StatusInternalServerError, "Qarz ID raqamini olishda xato.")
			return
		}

		var mijozIsmi string
		if err := db.QueryRow(
			"SELECT ism FROM mijozlar WHERE id = ?",
			q.MijozID,
		).Scan(&mijozIsmi); err != nil {
			xato(w, http.StatusInternalServerError, "Mijoz ismini olishda xato.")
			return
		}

		jsonYubor(w, http.StatusCreated, Qarz{
			ID: int(id), MijozID: q.MijozID,
			MijozIsmi: mijozIsmi, Summa: q.Summa,
			Qoldiq: q.Summa, Izoh: q.Izoh, Sana: sana,
		})

	default:
		metodTekshir(w, r, "GET, POST")
	}
}

func qarzAmallariHandler(w http.ResponseWriter, r *http.Request) {
	qismlar := strings.Split(
		strings.Trim(r.URL.Path, "/"), "/",
	)

	if len(qismlar) != 4 ||
		qismlar[0] != "api" ||
		qismlar[1] != "qarzlar" ||
		qismlar[3] != "tolovlar" {
		http.NotFound(w, r)
		return
	}

	if !metodTekshir(w, r, "POST") {
		return
	}

	id, err := strconv.Atoi(qismlar[2])
	if err != nil || id <= 0 {
		xato(w, http.StatusBadRequest, "Qarz ID raqami noto'g'ri.")
		return
	}

	var t TolovKiritish
	if err := jsonOqish(r, &t); err != nil {
		xato(w, http.StatusBadRequest, "To'lov ma'lumotlari noto'g'ri.")
		return
	}

	t.Izoh = strings.TrimSpace(t.Izoh)

	if t.Summa <= 0 || t.Summa > 1e12 {
		xato(w, http.StatusBadRequest, "To'lov summasi musbat bo'lishi kerak.")
		return
	}
	if len(t.Izoh) > 1000 {
		xato(w, http.StatusBadRequest, "To'lov izohi juda uzun.")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		xato(w, http.StatusInternalServerError, "To'lovni boshlashda xato.")
		return
	}
	defer tx.Rollback()

	var qoldiq float64
	err = tx.QueryRow(
		"SELECT qoldiq FROM qarzlar WHERE id = ?",
		id,
	).Scan(&qoldiq)

	if errors.Is(err, sql.ErrNoRows) {
		xato(w, http.StatusNotFound, "Qarz topilmadi.")
		return
	}
	if err != nil {
		xato(w, http.StatusInternalServerError, "Qarz qoldig'ini olishda xato.")
		return
	}

	if qoldiq <= 0 {
		xato(w, http.StatusBadRequest, "Bu qarz to'liq yopilgan.")
		return
	}
	if t.Summa > qoldiq {
		xato(w, http.StatusBadRequest, "To'lov summasi qolgan qarzdan oshmasligi kerak.")
		return
	}

	yangiQoldiq := qoldiq - t.Summa
	if yangiQoldiq < 0.005 {
		yangiQoldiq = 0
	}

	_, err = tx.Exec(`
		INSERT INTO tolovlar (qarz_id, summa, izoh, sana)
		VALUES (?, ?, ?, ?)
	`, id, t.Summa, t.Izoh, time.Now().Format(time.RFC3339))

	if err != nil {
		xato(w, http.StatusInternalServerError, "To'lovni saqlashda xato.")
		return
	}

	_, err = tx.Exec(
		"UPDATE qarzlar SET qoldiq = ? WHERE id = ?",
		yangiQoldiq, id,
	)
	if err != nil {
		xato(w, http.StatusInternalServerError, "Qarz qoldig'ini yangilashda xato.")
		return
	}

	if err := tx.Commit(); err != nil {
		xato(w, http.StatusInternalServerError, "To'lovni yakunlashda xato.")
		return
	}

	jsonYubor(w, http.StatusOK, map[string]any{
		"xabar":  "To'lov muvaffaqiyatli saqlandi",
		"qoldiq": yangiQoldiq,
	})
}

func main() {
	var err error

	bazaFayli := os.Getenv("QARZDAFTAR_DB")
	if bazaFayli == "" {
		bazaFayli = "qarzdaftar.db"
	}

	db, err = sql.Open("sqlite", bazaFayli)
	if err != nil {
		log.Fatal("Bazani ochib bo'lmadi: ", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(1)

	if err = db.Ping(); err != nil {
		log.Fatal("Bazaga ulanib bo'lmadi: ", err)
	}

	if _, err = db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		log.Fatal("Baza sozlamasida xato: ", err)
	}

	if err = bazaYaratish(); err != nil {
		log.Fatal("Bazani tayyorlashda xato: ", err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/mijozlar", mijozlarHandler)
	mux.HandleFunc("/api/qarzlar", qarzlarHandler)
	mux.HandleFunc("/api/qarzlar/", qarzAmallariHandler)

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if !metodTekshir(w, r, "GET") {
			return
		}
		if err := db.Ping(); err != nil {
			xato(w, http.StatusServiceUnavailable, "Baza bilan aloqa yo'q.")
			return
		}
		jsonYubor(w, http.StatusOK, map[string]string{
			"xabar": "QarzDaftar serveri ishlayapti.",
		})
	})

	server := &http.Server{
		Addr:              port,
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("QarzDaftar serveri ishga tushdi: http://localhost:4000")
	log.Println("Baza fayli:", bazaFayli)

	log.Fatal(server.ListenAndServe())
}
