/** Avatar color only applies to initials — hide the picker when a photo is set. */
export function shouldShowAvatarColorPicker(avatar?: string | null): boolean {
  return !avatar;
}
