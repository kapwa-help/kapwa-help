import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { extractExifGps } from "@/lib/exif-gps";
import { compressPhoto, uploadMedia } from "@/lib/photo";
import { insertFloodReport, type FloodReportInsert } from "@/lib/flood-queries";
import { roundCoord } from "@/lib/geohash";
import {
  FormLabel,
  FormInput,
  FormTextarea,
  FormSubmitButton,
  FormError,
  FormSuccess,
  FormSuccessButton,
} from "@/components/forms/form-fields";

interface Props {
  onSubmitted?: () => void;
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

export default function FloodReportForm({ onSubmitted }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<Date | null>(null);
  const [locationSource, setLocationSource] = useState<"exif" | "browser" | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [weatherEvent, setWeatherEvent] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestBrowserLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationSource("browser");
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
      },
    );
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const video = file.type.startsWith("video/");
    if (video && file.size > MAX_VIDEO_BYTES) {
      setError(t("FloodWatch.videoTooLarge"));
      return;
    }

    setIsVideo(video);
    setMediaFile(file);
    setError(null);

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(URL.createObjectURL(file));

    // Try EXIF GPS for images
    if (!video) {
      const exif = await extractExifGps(file);
      if (exif) {
        setCoords({ lat: exif.lat, lng: exif.lng });
        setLocationSource("exif");
        setPhotoTakenAt(exif.takenAt);
        return;
      }
    }

    // Fallback to browser geolocation
    setCoords(null);
    setLocationSource(null);
    setPhotoTakenAt(null);
    requestBrowserLocation();
  }

  function removeMedia() {
    setMediaFile(null);
    setIsVideo(false);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setCoords(null);
    setLocationSource(null);
    setPhotoTakenAt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaFile || !coords) return;
    setSubmitting(true);
    setError(null);

    try {
      const id = crypto.randomUUID();
      const ext = isVideo ? mediaFile.name.split(".").pop() ?? "mp4" : "jpg";
      const storagePath = `flood-reports/${id}.${ext}`;

      let uploadBlob: Blob;
      if (isVideo) {
        uploadBlob = mediaFile;
      } else {
        uploadBlob = await compressPhoto(mediaFile);
      }

      const mediaUrl = await uploadMedia("photos", storagePath, uploadBlob);
      if (!mediaUrl) {
        setError(t("FloodWatch.uploadFailed"));
        setSubmitting(false);
        return;
      }

      const payload: FloodReportInsert = {
        id,
        photo_url: mediaUrl,
        latitude: roundCoord(coords.lat),
        longitude: roundCoord(coords.lng),
        weather_event: weatherEvent.trim() || undefined,
        description: description.trim() || undefined,
        reporter_name: reporterName.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
        photo_taken_at: photoTakenAt?.toISOString(),
      };

      await insertFloodReport(payload);
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError(t("FloodWatch.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <FormSuccess>
        <h2 className="text-xl font-bold text-success">
          {t("FloodWatch.submitSuccess")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t("FloodWatch.submitSuccessDetail")}
        </p>
        <FormSuccessButton
          onClick={() => {
            setSubmitted(false);
            setWeatherEvent("");
            setDescription("");
            setReporterName("");
            setReporterPhone("");
            removeMedia();
          }}
        >
          {t("FloodWatch.submitAnother")}
        </FormSuccessButton>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo/Video */}
      <div>
        <FormLabel htmlFor="flood-media" required>
          {t("FloodWatch.photo")}
        </FormLabel>
        {mediaPreview ? (
          <div className="relative mt-1">
            {isVideo ? (
              <video
                src={mediaPreview}
                controls
                className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
              />
            ) : (
              <img
                src={mediaPreview}
                alt=""
                className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
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
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Location status */}
      {mediaFile && (
        <div className="rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-sm">
          {locationLoading && (
            <span className="text-neutral-400">{t("FloodWatch.locationAcquiring")}</span>
          )}
          {coords && locationSource === "exif" && (
            <span className="text-success">{t("FloodWatch.locationExif")}</span>
          )}
          {coords && locationSource === "browser" && (
            <span className="text-warning">{t("FloodWatch.locationBrowser")}</span>
          )}
          {!coords && !locationLoading && (
            <span className="text-error">{t("FloodWatch.locationFailed")}</span>
          )}
          {coords && (
            <span className="ml-2 text-neutral-400">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* Weather Event */}
      <div>
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
      <div>
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
      <div>
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
      <div>
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

      <FormError message={error} />

      <FormSubmitButton disabled={submitting || !mediaFile || !coords}>
        {submitting ? t("FloodWatch.submitting") : t("FloodWatch.submit")}
      </FormSubmitButton>
    </form>
  );
}
