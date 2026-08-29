import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Image,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';

import {
  CompositeNavigationProp,
} from '@react-navigation/native';

import {
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';

import { Ionicons } from '@expo/vector-icons';

import {
  RootStackParamList,
  MainTabParamList,
} from '../types';


import {
  AppText,
  AppModal,
  Header,
  Toast,
} from '../components';


import { useAuth } from '../context/AuthContext';
import { useMedications } from '../context/MedicationContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';


import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';


import {
  disablePhoneReminders,
  enablePhoneReminders,
  getEffectivePhoneRemindersEnabled,
} from '../services/notificationService';



type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;


type Props = {
  navigation: NavProp;
};

const profilePhotoStorageKey = (uid: string) =>
  `lia_profile_photo_${uid}`;



export default function ProfileScreen({
  navigation,
}: Props) {


  const {
    user,
    logout,
    isDemo,
  } = useAuth();


  const {
    medications,
  } = useMedications();



  const {
    mode,
    toggleSeniorMode,
    scaleSpacing,
  } = useAccessibility();



  const {
    colors,
  } = useTheme();




  const scrollRef =
    useRef<ScrollView>(null);



  const [
    showLogout,
    setShowLogout,
  ] = useState(false);



  const [
    phoneRemindersOn,
    setPhoneRemindersOn,
  ] = useState(false);



  const [
    togglingReminders,
    setTogglingReminders,
  ] = useState(false);



  const [
    profilePhotoUri,
    setProfilePhotoUri,
  ] = useState<string | null>(null);



  const [
    toast,
    setToast,
  ] = useState<{
    visible:boolean;
    message:string;
    type:'success'|'error'|'info';
  }>({
    visible:false,
    message:'',
    type:'info',
  });



  const refreshReminderState =
    useCallback(async()=>{

      const state =
        await getEffectivePhoneRemindersEnabled();


      setPhoneRemindersOn(
        state.effective
      );


    },[]);




  useEffect(()=>{

    void refreshReminderState();

  },[
    refreshReminderState,
    user?.uid,
    isDemo,
  ]);




  useEffect(()=>{

    scrollRef.current?.scrollTo({
      y:0,
      animated:false,
    });

  },[]);



  useEffect(()=>{

    if(!user?.uid){
      setProfilePhotoUri(null);
      return;
    }

    const uid = user.uid;

    void(async()=>{

      try{

        const stored =
          await AsyncStorage.getItem(
            profilePhotoStorageKey(uid)
          );

        setProfilePhotoUri(stored);

      }catch{

        setProfilePhotoUri(null);

      }

    })();

  },[
    user?.uid,
  ]);

  const handlePhoneRemindersToggle =
    (value:boolean)=>{


    if(togglingReminders)
      return;

    if(isDemo){

      setToast({
        visible:true,
        message:
        'En modo demo no se programan recordatorios del teléfono.',
        type:'info',
      });

      return;

    }

    if(!value){

      setTogglingReminders(true);

      void(async()=>{

        try{

          await disablePhoneReminders();

          setPhoneRemindersOn(false);


          setToast({
            visible:true,
            message:
            'Recordatorios del teléfono desactivados.',
            type:'success',
          });


        }finally{

          setTogglingReminders(false);

        }


      })();


      return;

    }



    Alert.alert(

      'Recordatorios del teléfono',
      'LÍA puede avisarte la hora de tus medicamentos aunque no estés usando la app.',

      [

        {
          text:'Ahora no',
          style:'cancel',
        },


        {
          text:'Activar',

          onPress:()=>{

            setTogglingReminders(true);


            void(async()=>{


              try{


                const result =
                  await enablePhoneReminders(
                    medications,
                    {
                      isDemo:false,
                    }
                  );


                await refreshReminderState();

                setToast({

                  visible:true,

                  message:
                    result.ok
                    ? 'Recordatorios activados.'
                    : result.message ||
                    'No se pudieron activar.',

                  type:
                    result.ok
                    ? 'success'
                    : 'error',

                });


              }finally{

                setTogglingReminders(false);

              }


            })();

          },

        },

      ]

    );


  };



  const handlePickProfilePhoto =
    useCallback(async()=>{

      if(!user?.uid)
        return;

      const uid = user.uid;

      try{

        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if(!permission.granted){

          Alert.alert(
            'Galería',
            'LÍA necesita acceso a tus fotos para cambiar tu foto de perfil.'
          );

          return;

        }

        const result =
          await ImagePicker.launchImageLibraryAsync({
            mediaTypes:['images'],
            allowsEditing:true,
            aspect:[1,1],
            quality:0.8,
          });

        if(result.canceled)
          return;

        const uri =
          result.assets[0]?.uri;

        if(!uri)
          return;

        await AsyncStorage.setItem(
          profilePhotoStorageKey(uid),
          uri
        );

        setProfilePhotoUri(uri);

      }catch{

        Alert.alert(
          'Foto de perfil',
          'No se pudo seleccionar la imagen. Inténtalo de nuevo.'
        );

      }

    },[
      user?.uid,
    ]);

    return (

    <View
      style={[
        styles.container
      ]}
    >

      <Header
        title="Tu perfil"
      />



      <ScrollView

        ref={scrollRef}

        showsVerticalScrollIndicator={false}

        contentContainerStyle={{
          paddingHorizontal:20,
          paddingBottom:40,
        }}

      >



        {/* TARJETA PERFIL */}


        <View

          style={[
            styles.profileCard
          ]}

        >


          <Pressable

            onPress={handlePickProfilePhoto}

            accessibilityRole="button"

            accessibilityLabel="Cambiar foto de perfil"

            style={styles.avatarWrap}

          >

            <View

              style={[
                styles.avatar,
                {
                  backgroundColor:
                  BrandColors.navy,
                  overflow:'hidden',
                },

              ]}

            >

              {
                profilePhotoUri
                ? (
                  <Image

                    source={{
                      uri:profilePhotoUri,
                    }}

                    style={styles.avatarImage}

                    onError={()=>{
                      setProfilePhotoUri(null);
                    }}

                  />
                )
                : (
                  <AppText

                    variant="h1"

                    style={{
                      color:
                      BrandColors.white,
                    }}

                  >

                    {
                      user?.fullName
                      ?.charAt(0)
                      ?.toUpperCase()
                      || 'U'
                    }

                  </AppText>
                )
              }

            </View>


            <View
              pointerEvents="none"
              style={styles.cameraBadge}
            >
              <Ionicons
                name="camera-outline"
                size={12}
                color={BrandColors.navy}
              />
            </View>

          </Pressable>



          <View
            style={{
              flex:1,
            }}
          >


            <AppText
              variant="h2"
            >

              {
                user?.fullName
                ||
                'Usuario'
              }

            </AppText>



            <AppText

              variant="body"

              tone="secondary"

              style={{
                marginTop:4,
              }}

            >

              {
                user?.email
              }

            </AppText>

          </View>

        </View>

        {/* NOTIFICACIONES */}

        <AppText

          variant="body"
          style={styles.sectionTitle}

        >

          Notificaciones

        </AppText>

        <View

          style={[
            styles.cardList
          ]}

        >

          <View
            style={styles.row}

          >
            <View
              style={styles.iconCircle}

            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#202124"

              />

            </View>

            <View

              style={{
                flex:1,
              }}

            >

              <AppText

                variant="body"

                style={{
                  fontWeight:'600',
                }}

              >

                Notificaciones

              </AppText>



              <AppText

                variant="caption"

                tone="secondary"

              >

                Avisos de medicamentos

              </AppText>


            </View>



            <Switch

              value={
                phoneRemindersOn
              }

              onValueChange={
                handlePhoneRemindersToggle
              }

              trackColor={{
                false:
                colors.border,

                true:
                BrandColors.teal,

              }}

              thumbColor={
                BrandColors.white
              }

            />



          </View>


        </View>







        {/* CUENTA */}



        <AppText

          variant="body"

          style={styles.sectionTitle}

        >

          Cuenta

        </AppText>




        <View

          style={[
            styles.cardList

          ]}

        >


          <ProfileOption

            icon="settings-outline"

            title="Configuración"

            onPress={() =>
              navigation.navigate(
                'Settings'
              )
            }

          />


        </View>

        {/* ACCESIBILIDAD */}



        <AppText

          variant="body"

          style={styles.sectionTitle}

        >

          Accesibilidad

        </AppText>

        <View

          style={[
            styles.cardList
          ]}

        >


          <ProfileOption

            icon="accessibility-outline"

            title="Modo adulto mayor"

            subtitle="Texto y botones más grandes"

            right={

              <Switch

                value={
                  mode === 'senior'
                }

                onValueChange={
                  toggleSeniorMode
                }

                trackColor={{
                  false:
                  colors.border,

                  true:
                  BrandColors.teal,

                }}

                thumbColor={
                  BrandColors.white
                }

              />

            }


          />



        </View>
                {/* SEGURIDAD */}


        {
          user?.emergencyContact && (

            <>

              <AppText

                variant="body"

                style={styles.sectionTitle}

              >

                Seguridad

              </AppText>



              <View

                style={[
                  styles.cardList
                ]}

              >

                <ProfileOption

                  icon="call-outline"

                  title="Contacto de emergencia"

                  subtitle={
                    user.emergencyContact
                  }

                />

              </View>


            </>

          )
        }


        {/* CERRAR SESIÓN */}

        <Pressable

          onPress={() =>
            setShowLogout(true)
          }

          style={styles.logout}

        >

          <Ionicons

            name="log-out-outline"

            size={20}

            color={colors.error}

          />


          <AppText

            variant="body"

            style={{
              color:
              colors.error,

              fontWeight:'600',
            }}

          >

            Cerrar sesión

          </AppText>


        </Pressable>
      </ScrollView>

      <AppModal

        visible={
          showLogout
        }

        title="Cerrar sesión"

        message="¿Estás seguro de que deseas salir?"

        confirmText="Salir"

        onConfirm={logout}

        onCancel={() =>
          setShowLogout(false)
        }

        destructive

      />




      <Toast

        visible={
          toast.visible
        }

        message={
          toast.message
        }

        type={
          toast.type
        }

        onHide={() =>
          setToast({
            ...toast,
            visible:false,
          })
        }
      />
    </View>
  );
}

function ProfileOption({

  icon,
  title,
  subtitle,
  right,
  onPress,

}:{

  icon:keyof typeof Ionicons.glyphMap;
  title:string;
  subtitle?:string;
  right?:React.ReactNode;
  onPress?:()=>void;

}){

  return (

    <Pressable
      onPress={onPress}
      style={styles.row}

    >

      <View
        style={styles.iconCircle}

      >
        <Ionicons
          name={icon}
          size={21}
          color="#202124"

        />

      </View>

      <View

        style={{
          flex:1,
        }}

      >

        <AppText

          variant="body"
          style={{
            fontWeight:'600',
          }}

        >

          {title}

        </AppText>
        {
          subtitle && (

            <AppText
              variant="caption"
              tone="secondary"
            >

              {subtitle}

            </AppText>

          )
        }

      </View>

      {
        right
        ||

        <Ionicons
          name="chevron-forward"
          size={20}
          color="#9AA0A6"
        />
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,

  },

  profileCard:{
    flexDirection:'row',
    alignItems:'center',
    padding:20,
    borderRadius:24,
    marginBottom:28,
    backgroundColor:'#FFFFFF',
    shadowColor:'#000000',
    shadowOpacity:0.05,
    shadowRadius:12,
    shadowOffset:{
      width:0,
      height:4,
    },
    elevation:2,
  },

  avatar:{
    width:72,
    height:72,
    borderRadius:36,
    alignItems:'center',
    justifyContent:'center',
    marginRight:18,
  },

  avatarWrap:{
    position:'relative',
  },

  avatarImage:{
    width:72,
    height:72,
    borderRadius:36,
  },

  cameraBadge:{
    position:'absolute',
    right:14,
    bottom:0,
    width:22,
    height:22,
    borderRadius:11,
    backgroundColor:'#FFFFFF',
    borderWidth:1,
    borderColor:'#F0F1F2',
    alignItems:'center',
    justifyContent:'center',
  },

  sectionTitle:{
    marginTop:5,
    marginBottom:12,
    color:'#6F747A',
    fontSize:18,
    fontWeight:'600',
    letterSpacing:-0.3,
    textTransform:'none',
  },

  cardList:{
    borderRadius:18,
    overflow:'hidden',
    marginBottom:22,
    backgroundColor:'#FFFFFF',
    borderWidth:1,
    borderColor:'#F0F1F2',
  },

  row:{
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:18,
    paddingVertical:16,
    gap:14,
  },

  iconCircle:{
    width:40,
    height:40,
    borderRadius:20,
    backgroundColor:'#FFFFFF',
    alignItems:'center',
    justifyContent:'center',
  },

  logout:{

    height:56,
    borderRadius:18,
    borderWidth:1,
    borderColor:'#E6B5B5',
    alignItems:'center',
    justifyContent:'center',
    flexDirection:'row',
    gap:10,
    marginTop:10,

  },

});