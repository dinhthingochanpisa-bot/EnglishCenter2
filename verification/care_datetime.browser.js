async (page) => {
  const dialog = page.getByRole('dialog', {name: 'Ghi nhận chăm sóc', exact: true});
  const input = dialog.getByLabel('Hẹn tiếp (tùy chọn)', {exact: true});
  await input.fill('2026-11-10T14:30');
  if (await input.inputValue() !== '2026-11-10T14:30') throw new Error('Care datetime must retain the entered local date and time');
  await dialog.getByLabel('Nội dung', {exact: true}).fill('Synthetic datetime regression');
  if (await input.inputValue() !== '2026-11-10T14:30') throw new Error('Care datetime lost after another field changed');
  await input.fill('2026-11-11T09:15');
  if (await input.inputValue() !== '2026-11-11T09:15') throw new Error('Care datetime cannot be edited');
  await input.fill('');
  if (await input.inputValue() !== '') throw new Error('Optional care datetime cannot be cleared');
  await input.fill('2026-11-10T14:30');
  return {status: 'PASS', cases: ['enter local datetime', 'retain after rerender', 'edit', 'clear optional datetime']};
}
