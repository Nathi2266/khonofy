// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildSrc, upload } from '@imagekit/javascript';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUiScale } from '@/hooks/useUiScale';
import { formatUiScalePercent } from '@/lib/ui-scale';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon12 from '@/assets/images/dashboard/12.png';
import dashboardIcon19 from '@/assets/images/dashboard/19.png';
import DiscLoader from '@/components/DiscLoader';
import PageLoader from '@/components/PageLoader';
import PageShell from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Camera,
  Check,
  ImageIcon,
  Mail,
  Phone,
  Save,
  Upload,
  Monitor,
  RotateCcw,
} from 'lucide-react';

const ROLE_LABELS = { superuser: 'Super User', admin: 'Admin', staff: 'Staff' };
const ROLE_COLORS = {
  superuser: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  staff: 'bg-slate-100 text-slate-600 border-slate-200',
};

function normalizeSouthAfricanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}

function canEditPhone(role) {
  return ['admin', 'superuser', 'staff'].includes(role);
}

function dedupeNamedOptions(items, selectedId) {
  const optionsByName = new Map();

  items.forEach((item) => {
    const normalizedName = String(item?.name || '').trim().toLowerCase();
    if (!normalizedName) return;

    const existing = optionsByName.get(normalizedName);
    if (!existing || item.id === selectedId) {
      optionsByName.set(normalizedName, item);
    }
  });

  return Array.from(optionsByName.values()).sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''))
  );
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    if (!url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.src = url;
  });
}

async function cropImage(imageSrc, croppedAreaPixels) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not prepare image cropper');
  }

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate cropped image'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

function getProfileImageUrl(user, imageKitConfig) {
  if (!user) return '';
  if (user.profile_image_path && imageKitConfig?.urlEndpoint) {
    return buildSrc({
      urlEndpoint: imageKitConfig.urlEndpoint,
      src: user.profile_image_path,
      transformation: [{ height: 320, width: 320 }],
    });
  }
  return user.profile_image_url || '';
}

export default function Profile() {
  const { data: user, isLoading } = useCurrentUser();
  const { scale: uiScale, setScale: setUiScale, resetScale: resetUiScale, minScale, maxScale, defaultScale } = useUiScale();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const revokePreviewRef = useRef(null);
  const [form, setForm] = useState({ full_name: '', phone: '', departmentId: '', designationId: '' });
  const [saved, setSaved] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState('');
  const [imageKitConfig, setImageKitConfig] = useState(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations'],
    queryFn: () => base44.entities.Designation.list(),
    enabled: !!user,
  });

  const visibleDepartments = useMemo(
    () => dedupeNamedOptions(departments, form.departmentId),
    [departments, form.departmentId]
  );

  const visibleDesignations = useMemo(
    () => dedupeNamedOptions(designations, form.designationId),
    [designations, form.designationId]
  );

  const profileImageUrl = useMemo(
    () => getProfileImageUrl(user, imageKitConfig),
    [user, imageKitConfig]
  );

  const initials = (user?.full_name || user?.email || '?')[0].toUpperCase();

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        departmentId: user.department_id || '',
        designationId: user.designation_id || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    base44.media.imagekitAuth()
      .then((auth) => {
        if (!cancelled) setImageKitConfig(auth);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('ImageKit auth failed:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (revokePreviewRef.current) {
        URL.revokeObjectURL(revokePreviewRef.current);
      }
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (overrides = {}) => {
      const payload = {
        full_name: overrides.full_name ?? form.full_name.trim(),
        phone: overrides.phone ?? normalizeSouthAfricanPhone(form.phone),
        departmentId: overrides.departmentId ?? (form.departmentId || null),
        designationId: overrides.designationId ?? (form.designationId || null),
      };

      if (overrides.profileImageUrl !== undefined) {
        payload.profileImageUrl = overrides.profileImageUrl;
      }

      if (overrides.profileImagePath !== undefined) {
        payload.profileImagePath = overrides.profileImagePath;
      }

      return base44.auth.updateMe(payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setPhoneNotice('Profile updated');
      setTimeout(() => setPhoneNotice(''), 2200);
      if (user) await logActivity(user, 'Updated profile', 'User', user.id);
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not save profile');
    },
  });

  useEffect(() => {
    if (!user || !canEditPhone(user.role)) return;
    const normalized = normalizeSouthAfricanPhone(form.phone);
    const current = String(form.phone || '');
    if (!normalized || current === normalized || saveMutation.isPending) return;

    const timeoutId = setTimeout(() => {
      saveMutation.mutate({ phone: normalized });
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [form.phone, user, saveMutation.isPending]);

  const resetCropDialog = () => {
    if (revokePreviewRef.current) {
      URL.revokeObjectURL(revokePreviewRef.current);
      revokePreviewRef.current = null;
    }
    setCropSource('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setUploadError('');
    setCropDialogOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      event.target.value = '';
      return;
    }

    if (revokePreviewRef.current) {
      URL.revokeObjectURL(revokePreviewRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    revokePreviewRef.current = previewUrl;
    setCropSource(previewUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setUploadError('');
    setCropDialogOpen(true);
  };

  const handleUploadCroppedImage = async () => {
    setUploadError('');

    if (!cropSource) {
      setUploadError('Choose an image before uploading.');
      return;
    }

    if (!croppedAreaPixels) {
      setUploadError('Adjust the crop area before uploading.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const auth = imageKitConfig || (await base44.media.imagekitAuth());
      if (!imageKitConfig) setImageKitConfig(auth);
      if (!auth?.publicKey || !auth?.signature || !auth?.token || !auth?.expire || !auth?.urlEndpoint) {
        throw new Error('ImageKit is not configured on the server');
      }

      const croppedBlob = await cropImage(cropSource, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], `profile-${user?.id || 'photo'}.jpg`, {
        type: croppedBlob.type || 'image/jpeg',
      });

      const result = await upload({
        file: croppedFile,
        fileName: croppedFile.name,
        folder: '/profiles',
        publicKey: auth.publicKey,
        signature: auth.signature,
        token: auth.token,
        expire: auth.expire,
        urlEndpoint: auth.urlEndpoint,
      });

      if (!result?.url || !result?.filePath) {
        throw new Error('Image upload did not return a valid file URL');
      }

      await saveMutation.mutateAsync({
        profileImageUrl: result.url,
        profileImagePath: result.filePath,
      });

      toast.success('Profile photo updated');
      resetCropDialog();
    } catch (error) {
      const message = error?.message || 'Photo upload failed';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageLoader label="Loading profile..." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="My Profile"
        description="Manage your account information, preferences, and profile photo."
        iconSrc={user?.role === 'admin' ? dashboardIcon1 : undefined}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <Avatar className="h-24 w-24 rounded-2xl border border-border">
                  <AvatarImage src={profileImageUrl} alt={user?.full_name || 'Profile photo'} />
                  <AvatarFallback className="rounded-2xl bg-primary/15 text-primary font-bold text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm transition hover:bg-accent"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Change photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelection}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{user?.full_name || 'User'}</h2>
                <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
                <span className={`inline-flex mt-2 items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${ROLE_COLORS[user?.role] || ROLE_COLORS.staff}`}>
                  <DashboardIcon src={dashboardIcon12} className={DASHBOARD_ICON_SIZES.section} />
                  {ROLE_LABELS[user?.role] || 'Staff'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Display Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Adjust how large the app appears in your browser. Your choice is saved on this device.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Interface size</span>
                <span className="font-semibold text-foreground">{formatUiScalePercent(uiScale)}</span>
              </div>

              <Slider
                value={[Math.round(uiScale * 100)]}
                min={Math.round(minScale * 100)}
                max={Math.round(maxScale * 100)}
                step={5}
                onValueChange={(value) => setUiScale(value[0] / 100)}
                aria-label="Interface size"
              />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatUiScalePercent(minScale)}</span>
                <span>Default {formatUiScalePercent(defaultScale)}</span>
                <span>{formatUiScalePercent(maxScale)}</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={resetUiScale}
                disabled={uiScale === defaultScale}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default ({formatUiScalePercent(defaultScale)})
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Account Info</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Member since</p>
                <p className="font-medium text-foreground mt-0.5">
                  {user?.created_date ? new Date(user.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">User ID</p>
                <p className="font-medium text-foreground font-mono text-xs mt-0.5">{user?.id?.slice(0, 12)}...</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h3 className="font-semibold text-foreground">Account Details</h3>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <DashboardIcon src={dashboardIcon1} className={DASHBOARD_ICON_SIZES.section} /> Full Name
              </label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Use any full name you want displayed across your account.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-muted-foreground" /> Email Address
              </label>
              <Input value={user?.email || ''} disabled className="bg-muted/40" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-muted-foreground" /> Phone Number
              </label>
              <Input
                placeholder="+27 81 471 9966"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                }}
                onBlur={() => {
                  if (!user || !canEditPhone(user.role)) return;
                  const normalized = normalizeSouthAfricanPhone(form.phone);
                  if (normalized && normalized !== form.phone) {
                    setForm((current) => ({ ...current, phone: normalized }));
                    saveMutation.mutate({ phone: normalized });
                  }
                }}
                disabled={!canEditPhone(user?.role)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {canEditPhone(user?.role)
                  ? 'Numbers are formatted as +27... and saved with your profile changes.'
                  : 'Phone editing is not available for your role.'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <DashboardIcon src={dashboardIcon19} className={DASHBOARD_ICON_SIZES.section} /> Department
              </label>
              <Select
                value={form.departmentId || '__none__'}
                onValueChange={(value) => setForm({ ...form, departmentId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {visibleDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Choose from the departments created by your superuser.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <DashboardIcon src={dashboardIcon1} className={DASHBOARD_ICON_SIZES.section} /> Designation
              </label>
              <Select
                value={form.designationId || '__none__'}
                onValueChange={(value) => setForm({ ...form, designationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {visibleDesignations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.id}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Choose from the designations created by your superuser.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <DashboardIcon src={dashboardIcon12} className={DASHBOARD_ICON_SIZES.section} /> Role
              </label>
              <Input
                value={ROLE_LABELS[user?.role] || 'Staff'}
                disabled
                className="bg-muted/40"
              />
              <p className="text-xs text-muted-foreground mt-1">Roles are assigned by your system administrator.</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || saved}
              className="gap-2"
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : saveMutation.isPending ? (
                <><DiscLoader size="sm" className="gap-1.5" label="Saving" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Save Changes</>
              )}
            </Button>
            {phoneNotice ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {phoneNotice}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={(open) => (!open ? resetCropDialog() : setCropDialogOpen(true))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop profile photo</DialogTitle>
            <DialogDescription>
              Drag the image to frame it, adjust the zoom, then upload the cropped version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-[420px] overflow-hidden rounded-xl bg-muted">
              {cropSource ? (
                <Cropper
                  image={cropSource}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropAreaChange={(_, pixels) => setCroppedAreaPixels(pixels)}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <ImageIcon className="h-4 w-4" />
                ImageKit upload preview
              </div>
              <p className="mt-1 text-xs leading-5">
                The selected image is cropped locally first, then uploaded to ImageKit using signed server auth.
              </p>
            </div>
          </div>

          {uploadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {uploadError}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={resetCropDialog} disabled={uploadingPhoto}>
              Cancel
            </Button>
            <Button onClick={handleUploadCroppedImage} disabled={uploadingPhoto} className="gap-2">
              {uploadingPhoto ? (
                <>
                  <DiscLoader size="sm" className="gap-1.5" label="Uploading" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}