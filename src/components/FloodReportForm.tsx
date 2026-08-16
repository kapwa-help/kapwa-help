import { useRef, useState, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { extractExifGps } from "@/lib/exif-gps";
import { compressPhoto, uploadMedia } from "@/lib/photo";
import { insertFloodReport, type FloodReportInsert } from "@/lib/flood-queries";
import { roundCoord } from "@/lib/geohash";
import {
  FormLabel,
  FormInput,
  FormTextarea,
  FormError,
} from "@/components/forms/form-fields";

const LocationPicker = lazy(() => import("@/components/maps/LocationPicker"));

interface Props {
  onSubmitted?: () => void;
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type ExifLocationStatus = "idle" | "loading" | "found" | "missing";

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseCoordString(raw: string): { lat: number; lng: number } | null {
  const parts = raw
    .replace(/[°'"NSEW]/gi, "")
    .split(/[,\s]+/)
    .map(Number);
  if (parts.length >= 2 && isFinite(parts[0]) && isFinite(parts[1])) {
    if (Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
      return { lat: parts[0], lng: parts[1] };
    }
  }
  return null;
}

export default function FloodReportForm({ onSubmitted }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [exifLocationStatus, setExifLocationStatus] = useState<ExifLocationStatus>("idle");
  const [photoTakenAt, setPhotoTakenAt] = useState<Date | null>(null);
  const [coordInput, setCoordInput] = useState("");

  const [eventDate, setEventDate] = useState(todayString);
  const [weatherEvent, setWeatherEvent] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationSource = exifLocationStatus === "found" ? "exif" : selectedCoords ? "manual" : null;

  const handleCoordsChange = useCallback((coords: { lat: number; lng: number }) => {
    setSelectedCoords(coords);
    setCoordInput(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
  }, []);

  function handleCoordInputChange(raw: string) {
    setCoordInput(raw);
    const parsed = parseCoordString(raw);
    setSelectedCoords(parsed);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const video = file.type.startsWith("video/");
    if (video && file.size > MAX_VIDEO_BYTES) {
      setError(t("FloodWatch.videoTooLarge"));
      return;
    }

    const token = ++selectionRef.current;
    setIsVideo(video);
    setMediaFile(file);
    setError(null);
    setSelectedCoords(null);
    setCoordInput("");
    setExifLocationStatus(video ? "missing" : "loading");
    setPhotoTakenAt(null);

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(URL.createObjectURL(file));

    if (!video) {
      try {
        const exif = await extractExifGps(file);
        if (selectionRef.current !== token) return;
        if (exif) {
          const coords = { lat: exif.lat, lng: exif.lng };
          setSelectedCoords(coords);
          setCoordInput(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          setExifLocationStatus("found");
          setPhotoTakenAt(exif.takenAt);
          if (exif.takenAt) {
            const d = exif.takenAt;
            setEventDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
          }
        } else {
          setExifLocationStatus("missing");
        }
      } catch {
        if (selectionRef.current !== token) return;
        setExifLocationStatus("missing");
      }
    }
  }

  function removeMedia() {
    selectionRef.current += 1;
    setMediaFile(null);
    setIsVideo(false);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setSelectedCoords(null);
    setCoordInput("");
    setExifLocationStatus("idle");
    setPhotoTakenAt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaFile || !selectedCoords || !eventDate) return;
    setSubmitting(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      const ext = isVideo ? mediaFile.name.split(".").pop() ?? "mp4" : "jpg";
      const storagePath = `flood-reports/${id}.${ext}`;

      const uploadBlob = isVideo ? mediaFile : await compressPhoto(mediaFile);

      const mediaUrl = await uploadMedia("photos", storagePath, uploadBlob);
      if (!mediaUrl) {
        setError(t("FloodWatch.uploadFailed"));
        setSubmitting(false);
        return;
      }

      const payload: FloodReportInsert = {
        id,
        photo_url: mediaUrl,
        latitude: roundCoord(selectedCoords.lat),
        longitude: roundCoord(selectedCoords.lng),
        event_date: eventDate,
        weather_event: weatherEvent.trim() || undefined,
        description: description.trim() || undefined,
        reporter_name: reporterName.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
        photo_taken_at: photoTakenAt?.toISOString(),
      };

      await insertFloodReport(payload);
      setSubmitted(true);
    } catch {
      setError(t("FloodWatch.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-success bg-success/10">
          <svg className="h-9 w-9 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neutral-50">
          {t("FloodWatch.submitSuccess")}
        </h2>
        <p className="mt-2 max-w-sm text-neutral-400">
          {t("FloodWatch.submitSuccessDetail")}
        </p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => onSubmitted?.()}
            className="rounded-xl border border-neutral-400/20 px-6 py-3 text-sm font-semibold text-neutral-100 hover:border-neutral-400 hover:text-neutral-50"
          >
            {t("FloodWatch.backToMap")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setEventDate(todayString());
              setWeatherEvent("");
              setDescription("");
              setReporterName("");
              setReporterPhone("");
              removeMedia();
            }}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-neutral-50 hover:bg-primary/80"
          >
            {t("FloodWatch.submitAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-0 md:grid-cols-2">
        {/* Left column: Photo & Details */}
        <div className="border-neutral-400/10 p-5 md:border-r">
          <div className="mb-4 text-[0.7rem] font-semibold uppercase tracking-widest text-neutral-400">
            {t("FloodWatch.photo")} & {t("FloodWatch.description")}
          </div>

          {/* Photo/Video */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-media" required>
              {t("FloodWatch.photo")}
            </FormLabel>
            {mediaPreview ? (
              <div className="relative mt-1">
                {isVideo ? (
                  <video
                    src={mediaPreview}
                    controls
                    className="aspect-[4/3] w-full rounded-xl border border-neutral-400/20 object-cover"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl border border-neutral-400/20 object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute right-2 top-2 rounded-full bg-base/80 p-1 text-neutral-50 hover:bg-base"
                  aria-label={t("FloodWatch.removeMedia")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-400/40 bg-base px-4 py-6 text-sm text-neutral-400 hover:border-primary hover:text-neutral-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                {t("FloodWatch.addMedia")}
              </button>
            )}
            <input
              ref={fileInputRef}
              id="flood-media"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Date */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-date" required>
              {t("FloodWatch.eventDate")}
            </FormLabel>
            <FormInput
              id="flood-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-neutral-400">{t("FloodWatch.eventDateHint")}</p>
          </div>

          {/* Weather Event */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-weather">{t("FloodWatch.weatherEvent")}</FormLabel>
            <FormInput
              id="flood-weather"
              type="text"
              value={weatherEvent}
              onChange={(e) => setWeatherEvent(e.target.value)}
              placeholder={t("FloodWatch.weatherEventPlaceholder")}
            />
          </div>

          {/* Description */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-description">{t("FloodWatch.description")}</FormLabel>
            <FormTextarea
              id="flood-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("FloodWatch.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          {/* Reporter Name */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-name">{t("FloodWatch.reporterName")}</FormLabel>
            <FormInput
              id="flood-name"
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder={t("FloodWatch.reporterNamePlaceholder")}
            />
            <p className="mt-1 text-xs text-neutral-400">{t("FloodWatch.adminOnly")}</p>
          </div>

          {/* Reporter Phone */}
          <div className="mb-5">
            <FormLabel htmlFor="flood-phone">{t("FloodWatch.reporterPhone")}</FormLabel>
            <FormInput
              id="flood-phone"
              type="tel"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder={t("FloodWatch.reporterPhonePlaceholder")}
            />
            <p className="mt-1 text-xs text-neutral-400">{t("FloodWatch.adminOnly")}</p>
          </div>
        </div>

        {/* Right column: Location (sticky) */}
        <div className="p-5 md:self-start md:sticky md:top-0">
          <div className="mb-4 text-[0.7rem] font-semibold uppercase tracking-widest text-neutral-400">
            {t("FloodWatch.locationTitle")} <span className="text-error">*</span>
          </div>

          {/* Mini-map */}
          <div className="mb-3 h-[450px] overflow-hidden rounded-xl border border-neutral-400/10">
            <Suspense fallback={<div className="flex h-full min-h-[220px] items-center justify-center text-neutral-400">{t("App.loading")}</div>}>
              <LocationPicker coords={selectedCoords} onChange={handleCoordsChange} readOnly={exifLocationStatus === "found"} />
            </Suspense>
          </div>

          {/* Location status */}
          <div className="mb-3 rounded-lg bg-secondary px-3 py-2.5 text-sm">
            {exifLocationStatus === "loading" ? (
              <span className="text-neutral-400">{t("FloodWatch.locationPhotoChecking")}</span>
            ) : locationSource === "exif" ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-warning">{t("FloodWatch.locationExif")}</span>
                </div>
                <span className="font-mono text-xs text-neutral-400">
                  {selectedCoords!.lat.toFixed(4)}, {selectedCoords!.lng.toFixed(4)}
                </span>
              </div>
            ) : selectedCoords ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-accent">{t("FloodWatch.locationManual")}</span>
                </div>
                <span className="font-mono text-xs text-neutral-400">
                  {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
                </span>
              </div>
            ) : (
              <span className="text-neutral-400">{t("FloodWatch.locationPrompt")}</span>
            )}
          </div>

          {/* Manual coordinate input */}
          {locationSource !== "exif" && (
            <div className="mt-3">
              <input
                type="text"
                value={coordInput}
                onChange={(e) => handleCoordInputChange(e.target.value)}
                placeholder={t("FloodWatch.locationPlaceholder")}
                className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2.5 font-mono text-sm text-neutral-50 placeholder:text-neutral-400/40 focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {/* Submit */}
          <FormError message={error} />
          <button
            type="submit"
            disabled={submitting || !mediaFile || !selectedCoords || !eventDate}
            className="mt-5 w-full rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-neutral-50 hover:bg-primary/80 disabled:cursor-not-allowed disabled:bg-primary/25 disabled:text-neutral-50/40"
          >
            {submitting ? t("FloodWatch.submitting") : t("FloodWatch.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}
