import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations) ??
        AppLocalizations(const Locale('en'));
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static final Map<String, Map<String, String>> _localizedValues = {
    'en': {
      'app_title': 'DeliveryOS',
      'tagline': 'Fast. Fresh. Tracked in Real-Time.',
      'select_language': 'Select Language',
      'continue_btn': 'Continue',
      'skip_guest': 'Explore as Guest',
      'login_title': 'Enter Your Phone Number',
      'login_subtitle': 'We will send a 6-digit confirmation OTP code',
      'phone_hint': '01700-000005',
      'send_otp': 'Send Verification Code',
      'otp_title': 'Verify Phone Number',
      'otp_subtitle': 'Enter the 6-digit code sent to',
      'verify_btn': 'Verify & Login',
      'resend_code': 'Resend Code',
      'resend_in': 'Resend code in',
      'invalid_otp': 'Invalid OTP code. Please try again.',
      'dev_otp_hint': 'Dev Mode Universal OTP: 123456',
      'location_title': 'Choose Delivery Location',
      'location_subtitle': 'Pin your exact address on the map to find nearby restaurants & stores',
      'current_location': 'Use Current Location',
      'confirm_location': 'Confirm Delivery Address',
      'retry': 'Retry',
      'address_label': 'Address Label',
      'home': 'Home',
      'work': 'Work',
      'other': 'Other',
      'address_details_hint': 'House / Flat / Road instructions (optional)',
      'finding_nearby': 'Locating open stores in this area...',
      'stores_found': 'stores deliver to this address',
      'home_greeting': 'Delivering To',
      'change_location': 'Change',
      'search_hint': 'Search dishes, groceries, outlets...',
      'categories': 'Categories',
      'restaurants': 'Restaurants',
      'groceries': 'Groceries',
      'saved_addresses': 'Saved Addresses',
      'my_profile': 'My Profile',
      'payment_method': 'Payment Method',
      'cash_on_delivery': 'Cash on Delivery',
      'online_gateway': 'Online Gateway',
      'order_history': 'Order History',
      'logout': 'Logout',
    },
    'ar': {
      'app_title': 'ديليفري أو إس',
      'tagline': 'سريع. طازج. تتبع فوري مباشر.',
      'select_language': 'اختر اللغة',
      'continue_btn': 'متابعة',
      'skip_guest': 'تصفح كضيف',
      'login_title': 'أدخل رقم هاتفك',
      'login_subtitle': 'سنرسل لك رمز تأكيد مكون من 6 أرقام عبر رسالة قصيرة',
      'phone_hint': '0500000000',
      'send_otp': 'إرسال رمز التحقق',
      'otp_title': 'تأكيد رقم الهاتف',
      'otp_subtitle': 'أدخل الرمز المكون من 6 أرقام المرسل إلى',
      'verify_btn': 'تأكيد ودخول',
      'resend_code': 'إعادة إرسال الرمز',
      'resend_in': 'إعادة الإرسال خلال',
      'invalid_otp': 'رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى.',
      'dev_otp_hint': 'رمز التطوير العام: 123456',
      'location_title': 'اختر موقع التوصيل',
      'location_subtitle': 'حدد موقعك بدقة على الخريطة لاكتشاف المتاجر والمطاعم المجاورة',
      'current_location': 'استخدام موقعي الحالي',
      'confirm_location': 'تأكيد عنوان التوصيل',
      'retry': 'إعادة المحاولة',
      'address_label': 'نوع العنوان',
      'home': 'المنزل',
      'work': 'العمل',
      'other': 'أخرى',
      'address_details_hint': 'رقم الشقة / الدور / ملاحظات التوصيل (اختياري)',
      'finding_nearby': 'جاري البحث عن المتاجر النشطة في منطقتك...',
      'stores_found': 'متاجر توصل لهذا العنوان',
      'home_greeting': 'التوصيل إلى',
      'change_location': 'تغيير',
      'search_hint': 'ابحث عن أطباق، مقاضي، مطاعم...',
      'categories': 'الأقسام',
      'restaurants': 'مطاعم',
      'groceries': 'بقالة وسوبرماركت',
      'saved_addresses': 'العناوين المحفوظة',
      'my_profile': 'ملفي الشخصي',
      'payment_method': 'طريقة الدفع',
      'cash_on_delivery': 'الدفع عند الاستلام',
      'online_gateway': 'بوابة الدفع الإلكتروني',
      'order_history': 'سجل الطلبات',
      'logout': 'تسجيل الخروج',
    },
    'bn': {
      'app_title': 'ডেলিভারি ওএস',
      'tagline': 'দ্রুত। টাটকা। লাইভ ট্র্যাকিং।',
      'select_language': 'ভাষা নির্বাচন করুন',
      'continue_btn': 'এগিয়ে যান',
      'skip_guest': 'গেস্ট হিসেবে ব্রাউজ করুন',
      'login_title': 'আপনার মোবাইল নম্বর দিন',
      'login_subtitle': 'আমরা ৬ সংখ্যার একটি ওটিপি ভেরিফিকেশন কোড পাঠাবো',
      'phone_hint': '০১৭০০-০০০০০৫',
      'send_otp': 'ওটিপি কোড পাঠান',
      'otp_title': 'মোবাইল নম্বর যাচাই',
      'otp_subtitle': 'পাঠানো ৬ সংখ্যার কোডটি লিখুন:',
      'verify_btn': 'যাচাই করে লগইন করুন',
      'resend_code': 'পুনরায় কোড পাঠান',
      'resend_in': 'পুনরায় কোড পাঠাতে বাকি',
      'invalid_otp': 'ভুল ওটিপি কোড। আবার চেষ্টা করুন।',
      'dev_otp_hint': 'ডেভ মোড সার্বজনীন ওটিপি: 123456',
      'location_title': 'ডেলিভারি লোকেশন বেছে নিন',
      'location_subtitle': 'নিকটবর্তী রেস্তোরাঁ ও শপ দেখতে ম্যাপে ঠিকানা পিন করুন',
      'current_location': 'বর্তমান লোকেশন ব্যবহার করুন',
      'confirm_location': 'ডেলিভারি ঠিকানা নিশ্চিত করুন',
      'retry': 'আবার চেষ্টা করুন',
      'address_label': 'ঠিকানার ধরন',
      'home': 'বাসা',
      'work': 'অফিস',
      'other': 'অন্যান্য',
      'address_details_hint': 'বাড়ি নং / ফ্ল্যাট / বিশেষ নির্দেশনা (ঐচ্ছিক)',
      'finding_nearby': 'এই এলাকায় খোলা স্টোর খোঁজা হচ্ছে...',
      'stores_found': 'টি স্টোর ডেলিভারি দিচ্ছে',
      'home_greeting': 'ডেলিভারি ঠিকানা',
      'change_location': 'পরিবর্তন',
      'search_hint': 'খাবার, গ্রোসারি, বা আউটলেট খুঁজুন...',
      'categories': 'ক্যাটাগরি',
      'restaurants': 'রেস্টুরেন্ট',
      'groceries': 'গ্রোসারি',
      'saved_addresses': 'সংরক্ষিত ঠিকানা',
      'my_profile': 'আমার প্রোফাইল',
      'payment_method': 'পেমেন্ট পদ্ধতি',
      'cash_on_delivery': 'ক্যাশ অন ডেলিভারি',
      'online_gateway': 'অনলাইন গেটওয়ে',
      'order_history': 'অর্ডার হিস্ট্রি',
      'logout': 'লগআউট',
    },
  };

  String translate(String key) {
    return _localizedValues[locale.languageCode]?[key] ??
        _localizedValues['en']?[key] ??
        key;
  }

  bool get isRtl => locale.languageCode == 'ar';
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => ['en', 'ar', 'bn'].contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(locale);
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
