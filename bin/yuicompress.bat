@ECHO OFF
SET PATHTOYUI=%CD%\cmd
ECHO.
ECHO ==============================================
ECHO COMPRESSING JAVASCRIPTS
ECHO ==============================================
CD js\src
ECHO ON
@FOR %%f IN ("*.js") DO @ECHO %%f & ^
java -jar %PATHTOYUI%\yuicompressor-2.4.2.jar -v --type js --charset utf-8 -o ..\%%f %%f"
CD ..\..
@ECHO OFF
ECHO.
ECHO ==============================================
ECHO COMPRESSING STYLESHEETS
ECHO ==============================================
CD css\src
ECHO ON
@FOR %%f IN ("*.css") DO @ECHO %%f & ^
java -jar %PATHTOYUI%\yuicompressor-2.4.2.jar -v --type css --charset utf-8 -o ..\%%f %%f"
@ECHO OFF
CD ..\..
ECHO.
ECHO READY.