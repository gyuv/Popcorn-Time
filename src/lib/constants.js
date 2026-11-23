export const COUNTRIES = [
  ['US','United States'],['GB','United Kingdom'],['IN','India'],['CA','Canada'],['AU','Australia'],['DE','Germany'],
  ['FR','France'],['ES','Spain'],['IT','Italy'],['JP','Japan'],['KR','South Korea'],['CN','China'],['BR','Brazil'],
  ['MX','Mexico'],['AR','Argentina'],['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['DK','Denmark'],['FI','Finland'],
  ['PL','Poland'],['TR','Turkey'],['RU','Russia'],['ZA','South Africa'],['NG','Nigeria'],['EG','Egypt'],['AE','United Arab Emirates'],
  ['SA','Saudi Arabia'],['ID','Indonesia'],['PH','Philippines'],['TH','Thailand'],['MY','Malaysia'],['SG','Singapore'],
  ['PK','Pakistan'],['BD','Bangladesh'],['LK','Sri Lanka'],['NZ','New Zealand'],['IE','Ireland'],['PT','Portugal'],['BE','Belgium'],
];
// [ISO 639-1, English name, TMDB UI locale]
export const LANGUAGES = [
  ['en','English','en-US'],['hi','Hindi','hi-IN'],['ta','Tamil','ta-IN'],['te','Telugu','te-IN'],['ml','Malayalam','ml-IN'],
  ['kn','Kannada','kn-IN'],['bn','Bengali','bn-BD'],['mr','Marathi','mr-IN'],['pa','Punjabi','pa-IN'],['ur','Urdu','ur-PK'],
  ['es','Spanish','es-ES'],['fr','French','fr-FR'],['de','German','de-DE'],['it','Italian','it-IT'],['pt','Portuguese','pt-BR'],
  ['ja','Japanese','ja-JP'],['ko','Korean','ko-KR'],['zh','Chinese','zh-CN'],['ru','Russian','ru-RU'],['tr','Turkish','tr-TR'],
  ['ar','Arabic','ar-SA'],['th','Thai','th-TH'],['id','Indonesian','id-ID'],['nl','Dutch','nl-NL'],['sv','Swedish','sv-SE'],
  ['pl','Polish','pl-PL'],['da','Danish','da-DK'],['no','Norwegian','no-NO'],
];
export const langName = c => LANGUAGES.find(l => l[0] === c)?.[1] || c;
export const countryName = c => COUNTRIES.find(x => x[0] === c)?.[1] || c;

export const SORTS = [
  ['popularity.desc','Most popular'],['vote_average.desc','Highest rated'],['primary_release_date.desc','Newest'],
  ['primary_release_date.asc','Oldest'],['revenue.desc','Box office'],['vote_count.desc','Most voted'],['original_title.asc','A → Z'],
];
export const ACCENTS = {
  violet: { a: '#8b3dff', b: '#e040fb' },
  blue: { a: '#2f5bff', b: '#38c6ff' },
  popcorn: { a: '#ff8a1f', b: '#ffc65c' },
  magenta: { a: '#d62bd8', b: '#ff6bd5' },
};
