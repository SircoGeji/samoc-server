import regenerate from 'regenerate';

export const getValidTextFieldRegExp = () => {
    let result = regenerate()
      .add('!', '"', '#', '$', '%', '&', "'", '(', ')', '*',
           '+', ',', '-', '.', '/', ':', ';', '<', '=', '>',
           '?', '@', '[', ']', '^', '_', '`', '§', '©', '‐',
           '‑', '–', '—', '‘', '’', '“', '”', '†', '‡', '…',
           '‰', '′', '″', '€', '−', '|', '{', '}', ' ', '\n',
           '£') // special symbols
      .addRange('0', '9') // numbers 0-9
      .addRange('A', 'Z') // English A-Z
      .addRange('a', 'z') // English a-z
      .add('À', 'Â', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Î', 'Ï',
           'Ô', 'Ù', 'Û', 'Ü', 'à', 'â', 'æ', 'ç', 'è', 'é',
           'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û', 'ü', 'ÿ', 'Œ',
           'œ', 'Ÿ', 'ʳ', 'ˢ', 'ᵈ', 'ᵉ') // French special characters
      .add('Ä', 'Ö', 'Ü', 'ß', 'ä', 'ö', 'ü') // German special characters
      .add('À', 'Ä', 'Å', 'É', 'Ö', 'à', 'ä', 'å', 'é', 'ö') // Swedish special characters
      .add('¡', '¿', 'Á', 'É', 'Í', 'Ñ', 'Ó', 'Ú', 'Ü', 'á',
           'é', 'í', 'ñ', 'ó', 'ú', 'ü') // Spanish special characters
      .add('À', 'Á', 'Â', 'Ã', 'Ç', 'É', 'Ê', 'Í', 'Ò', 'Ó',
           'Ô', 'Õ', 'Ú', 'à', 'á', 'â', 'ã', 'ç', 'é', 'ê',
           'í', 'ò', 'ó', 'ô', 'õ', 'ú') // Portuguese special characters
      .add('À', 'È', 'É', 'Ì', 'Ò', 'Ó', 'Ù', 'à', 'è', 'é',
           'ì', 'ò', 'ó', 'ù') // Italian special characters
      .add('Á', 'Ä', 'É', 'Ë', 'Í', 'Ï', 'Ó', 'Ö', 'Ú', 'Ü',
           'á', 'ä', 'é', 'ë', 'í', 'ï', 'ó', 'ö', 'ú', 'ü',
           'ĳ', 'j́') // Dutch special characters
      .toString()

    result = `^${result}*$`; // to match several words after space

    return new RegExp(result)
  }
