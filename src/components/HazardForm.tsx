import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getActiveEvent, insertHazard, type HazardInsert } from "@/lib/queries";
import { compressPhoto, uploadPhoto } from "@/lib/photo";
import { roundCoord } from "@/lib/geohash";
import { getCachedOptions, addToOutbox } from "@/lib/form-cache";
import { useOutbox } from "@/lib/outbox-context";
import {
  FormLabel,
  FormInput,
  FormTextarea,
  FormSubmitButton,
  FormError,
  FormSuccess,
  FormSuccessButton,
} from "@/components/forms/form-fields";

interface HazardFormProps {
  coords: { lat: number; lng: number } | null;
}

export default function HazardForm({ coords }: HazardFormProps) {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    getCachedOptions<{ id: string; name: string }>("activeEvent").then((cachedE) => {
      if (cachedE?.data.length) setEventId(cachedE.data[0].id);

      getActiveEvent()
        .then((event) => { if (event) setEventId(event.id); })
        .catch(() => {});
    });
  }, []);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function removePhoto() {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!eventId) {
        setError(t("HazardForm.error"));
        setSubmitting(false);
        return;
      }

      const id = crypto.randomUUID();

      // Compress photo if present (works offline — pure browser APIs)
      let compressedPhoto: Blob | undefined;
      if (photo) {
        compressedPhoto = await compressPhoto(photo);
      }

      const payload: HazardInsert = {
        id,
        event_id: eventId,
        description,
        latitude: roundCoord(coords.lat),
        longitude: roundCoord(coords.lng),
        reported_by: reportedBy || undefined,
        contact_phone: contactPhone || undefined,
      };

      try {
        // Online path: upload photo then insert
        if (compressedPhoto) {
          const photoUrl = (await uploadPhoto("photos", `hazards/${id}.jpg`, compressedPhoto)) ?? undefined;
          payload.photo_url = photoUrl;
        }
        await insertHazard(payload);
        setSubmitted(true);
      } catch {
        try {
          // Offline path: store payload + photo blob in outbox
          await addToOutbox({ type: "hazard", payload, photo: compressedPhoto });
          refreshCount();
          setSavedOffline(true);
          setSubmitted(true);
        } catch {
          setError(t("HazardForm.error"));
        }
      }
    } catch {
      setError(t("HazardForm.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <FormSuccess>
        <h2 className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}>
          {t(savedOffline ? "HazardForm.savedTitle" : "HazardForm.success")}
        </h2>
        {savedOffline && (
          <p className="mt-2 text-neutral-400">
            {t("HazardForm.savedMessage")}
          </p>
        )}
        <FormSuccessButton
          onClick={() => {
            setSubmitted(false);
            setSavedOffline(false);
            setDescription("");
            setReportedBy("");
            setContactPhone("");
            removePhoto();
          }}
        >
          {t("SubmitForm.submitAnother")}
        </FormSuccessButton>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Description */}
      <div>
        <FormLabel htmlFor="hazard-description" required>
          {t("HazardForm.description")}
        </FormLabel>
        <FormTextarea
          id="hazard-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("HazardForm.descriptionPlaceholder")}
          required
          rows={3}
        />
      </div>

      {/* Photo */}
      <div>
        <FormLabel htmlFor="hazard-photo">{t("HazardForm.photo")}</FormLabel>
        {photoPreview ? (
          <div className="relative mt-1">
            <img
              src={photoPreview}
              alt=""
              className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute right-2 top-2 rounded-full bg-base/80 p-1 text-neutral-50 hover:bg-base"
              aria-label="Remove photo"
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
            {t("HazardForm.photoButton")}
          </button>
        )}
        <input
          ref={fileInputRef}
          id="hazard-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {/* Reported by */}
      <div>
        <FormLabel htmlFor="hazard-reported-by">
          {t("HazardForm.reportedBy")}
        </FormLabel>
        <FormInput
          id="hazard-reported-by"
          type="text"
          value={reportedBy}
          onChange={(e) => setReportedBy(e.target.value)}
          placeholder={t("HazardForm.reportedByPlaceholder")}
        />
      </div>

      {/* Contact phone */}
      <div>
        <FormLabel htmlFor="hazard-contact-phone">
          {t("HazardForm.contactPhone")}
        </FormLabel>
        <FormInput
          id="hazard-contact-phone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder={t("HazardForm.contactPhonePlaceholder")}
        />
      </div>

      <FormError message={error} />

      <FormSubmitButton disabled={submitting || !coords || !description.trim()}>
        {submitting ? t("HazardForm.submitting") : t("HazardForm.submit")}
      </FormSubmitButton>
    </form>
  );
}
