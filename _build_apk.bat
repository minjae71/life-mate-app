@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
cd /d D:\workspace\todo-subway-app\android
call gradlew.bat assembleDebug
